/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference types="@fastly/js-compute" />
import { ConfigStore } from "fastly:config-store";
import { Dictionary } from "fastly:dictionary";

const RECAPTCHA_JS = "https://www.google.com/recaptcha/enterprise.js";
// Firewall Policies API is currently only available in the public preview.
const POLICY_RECAPTCHA_ENDPOINT = "https://public-preview-recaptchaenterprise.googleapis.com";

import {
  RecaptchaConfig,
  RecaptchaContext,
  LogLevel,
  InitError,
  EdgeResponse,
  EdgeRequest,
  FetchApiResponse,
  FetchApiRequest,
  EdgeResponseInit,
  EdgeRequestInit,
  Event,
  Assessment,
  ListFirewallPoliciesResponse,
  CHALLENGE_PAGE_URL,
} from "@google-cloud/recaptcha-edge";
import pkg from "../package.json";
import { CacheOverride } from "fastly:cache-override";

const streamReplace = (
  inputStream: ReadableStream<Uint8Array>,
  targetStr: string,
  replacementStr: string,
): ReadableStream<Uint8Array> => {
  let buffer = "";
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();
  const inputReader = inputStream.getReader();
  let found = false; // Flag to track if replacement has been made.

  const outputStream = new ReadableStream<Uint8Array>({
    start() {
      buffer = "";
      found = false;
    },
    async pull(controller) {
      const { value: chunk, done: readerDone } = await inputReader.read();

      if (chunk) {
        buffer += decoder.decode(chunk);
      }

      if (!found) {
        // Only perform replacement if not already found.
        let targetIndex = buffer.indexOf(targetStr);
        if (targetIndex !== -1) {
          const beforeTarget = buffer.slice(0, targetIndex);
          const afterTarget = buffer.slice(targetIndex + targetStr.length);
          controller.enqueue(encoder.encode(beforeTarget + replacementStr));
          buffer = afterTarget;
          targetIndex = -1;
          found = true;
        }
      }

      if (readerDone) {
        controller.enqueue(encoder.encode(buffer));
        controller.close();
      } else if (buffer.length > targetStr.length && !found) {
        const safeChunk = buffer.slice(0, buffer.length - targetStr.length);
        controller.enqueue(encoder.encode(safeChunk));
        buffer = buffer.slice(buffer.length - targetStr.length);
      }
    },
    cancel() {
      inputReader.cancel();
    },
  });

  return outputStream;
};

export {
  callCreateAssessment,
  callListFirewallPolicies,
  NetworkError,
  ParseError,
  processRequest,
  RecaptchaConfig,
  RecaptchaError,
} from "@google-cloud/recaptcha-edge";

export class FastlyContext extends RecaptchaContext {
  readonly sessionPageCookie = "recaptcha-fastly-t";
  readonly challengePageCookie = "recaptcha-fastly-e";
  readonly environment: [string, string] = [pkg.name, pkg.version];
  start_time: number;

  constructor(
    private event: FetchEvent,
    cfg: RecaptchaConfig,
  ) {
    super(cfg);
    this.start_time = performance.now();
  }

  /**
   * Log performance debug information.
   *
   * This method should conditionally log performance only if the
   * config.debug flag is set to true.
   */
  log_performance_debug(event: string) {
    if (this.config.debug) {
      this.debug_trace.performance_counters.push([event, performance.now() - this.start_time]);
    }
  }

  async buildEvent(req: EdgeRequest): Promise<Event> {
    return {
      // extracting common signals
      userIpAddress: this.event.client.address ?? undefined,
      headers: Array.from(req.getHeaders().entries()).map(([k, v]) => `${k}:${v}`),
      ja3: this.event.client.tlsJA3MD5 ?? undefined,
      requestedUri: req.url,
      userAgent: req.getHeader("user-agent") ?? undefined,
    };
  }

  async injectRecaptchaJs(resp: EdgeResponse): Promise<EdgeResponse> {
    let base_resp = (resp as FetchApiResponse).asResponse();
    const sessionKey = this.config.sessionSiteKey;
    const RECAPTCHA_JS_SCRIPT = `<script src="${RECAPTCHA_JS}?render=${sessionKey}&waf=session" async defer></script>`;
    // rewrite the response
    if (resp.getHeader("Content-Type")?.startsWith("text/html")) {
      const newRespStream = streamReplace(base_resp.body!, "</head>", RECAPTCHA_JS_SCRIPT + "</head>");
      resp = new FetchApiResponse(new Response(newRespStream, base_resp));
    }
    return Promise.resolve(resp);
  }

  log(level: LogLevel, msg: string) {
    console.log(msg);
    super.log(level, msg);
  }

  createResponse(body: string, options?: EdgeResponseInit): EdgeResponse {
    return new FetchApiResponse(body, options);
  }

  async fetch(req: EdgeRequest, options?: RequestInit): Promise<EdgeResponse> {
    let base_req = req as FetchApiRequest;
    return fetch(base_req.asRequest(), options).then((v) => {
      return new FetchApiResponse(v);
    });
  }

  /**
   * Fetch from the customer's origin.
   * Parameters and outputs are the same as the 'fetch' function.
   */
  async fetch_origin(req: EdgeRequest): Promise<EdgeResponse> {
    return this.fetch(req, { backend: "origin" });
  }

  /**
   * Call fetch for ListFirewallPolicies.
   * Parameters and outputs are the same as the 'fetch' function.
   */
  async fetch_list_firewall_policies(options: EdgeRequestInit): Promise<ListFirewallPoliciesResponse> {
    let cacheOverride = new CacheOverride("override", { ttl: 600 });
    const req = new FetchApiRequest(new Request(this.listFirewallPoliciesUrl, options));
    return this.fetch(req, { backend: "recaptcha", cacheOverride }).then((response) =>
      this.toListFirewallPoliciesResponse(response),
    );
  }

  /**
   * Call fetch for CreateAssessment
   * Parameters and outputs are the same as the 'fetch' function.
   */
  async fetch_create_assessment(options: EdgeRequestInit): Promise<Assessment> {
    const req = new FetchApiRequest(new Request(this.assessmentUrl, options));
    return this.fetch(req, { backend: "recaptcha" }).then((response) => this.toAssessment(response));
  }

  /**
   * Call fetch for getting the ChallengePage
   */
  async fetch_challenge_page(options: EdgeRequestInit): Promise<EdgeResponse> {
    const req = new FetchApiRequest(new Request(CHALLENGE_PAGE_URL, options));
    return this.fetch(req, {
      backend: "google",
    });
  }
}

export function recaptchaConfigFromConfigStore(name: string): RecaptchaConfig {
  let cfg: Dictionary | ConfigStore;
  try {
    cfg = new ConfigStore(name);
  } catch (e) {
    // eslint-disable-line  @typescript-eslint/no-unused-vars
    try {
      // Backup. Try dictionary.
      cfg = new Dictionary(name);
    } catch (e) {
      throw new InitError('Failed to open Fastly config store: "' + name + '". ' + JSON.stringify(e));
    }
  }
  const has_policy_keys =
    cfg.get("action_site_key") || cfg.get("session_site_key") || cfg.get("challengepage_site_key");
  return {
    projectNumber: Number(cfg.get("project_number")),
    apiKey: cfg.get("api_key") ?? "",
    actionSiteKey: cfg.get("action_site_key") ?? undefined,
    expressSiteKey: cfg.get("express_site_key") ?? undefined,
    sessionSiteKey: cfg.get("session_site_key") ?? undefined,
    challengePageSiteKey: cfg.get("challengepage_site_key") ?? undefined,
    enterpriseSiteKey: cfg.get("enterprise_site_key") ?? undefined,
    recaptchaEndpoint: cfg.get("recaptcha_endpoint") ?? (has_policy_keys ? POLICY_RECAPTCHA_ENDPOINT : undefined),
    sessionJsInjectPath: cfg.get("session_js_install_path") ?? undefined,
    debug: (cfg.get("debug") ?? "false") == "true",
    unsafe_debug_dump_logs: (cfg.get("unsafe_debug_dump_logs") ?? "false") == "true",
  };
}
