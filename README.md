# reCAPTCHA Edge Compute Library

[![Build and Test Core Library](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_core.yml/badge.svg)](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_core.yml)
[![Build and Test Akamai Binding](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_akamai.yml/badge.svg)](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_akamai.yml)
[![Build and Test Cloudflare Binding](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_cloudflare.yml/badge.svg)](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_cloudflare.yml)
[![Build and Test Fastly Binding](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_fastly.yml/badge.svg)](https://github.com/GoogleCloudPlatform/recaptcha-edge/actions/workflows/build_fastly.yml)

A library to access reCAPTCHA Enterprise via various edge compute platforms. The currently supported platforms are:

* [Cloudflare](https://github.com/GoogleCloudPlatform/recaptcha-edge/tree/main/bindings/cloudflare)
* [Fastly](https://github.com/GoogleCloudPlatform/recaptcha-edge/tree/main/bindings/fastly)

## Usage
This project is intended to be used in one of two ways:

1. Using a prebuilt package uploaded to your edge compute platform of choice.
2. or imported as an NPM package for advanced use-cases.

### Prebuilt Package
Check the [Releases](https://github.com/GoogleCloudPlatform/recaptcha-edge/releases) page for the most recent build for your edge compute platform of choice. 
The prebuilt packages are intended to be used with the [reCAPTCHA Firewall Policies](https://cloud.google.com/recaptcha/docs/firewall-policies-overview) feature.

Typically, this involves:
* Create the appropriate reCAPTCHA Site Keys in [Google Cloud reCAPTCHA Console](https://console.cloud.google.com/security/recaptcha).
* Upload and install the package to your edge compute platform.
* Configure the package to use the created reCAPTCHA Site Keys.
* Create a set of Firewall Policies to protect sensitive pages or actions.

Please see the [reCAPTCHA Google Cloud Documentation](https://cloud.google.com/recaptcha/docs) for more details on each step.

### As a Library
Each platform has their own NPM package. Bindings that are hosted on NPM include:
* [@google-cloud/recaptcha-cloudflare](https://www.npmjs.com/package/@google-cloud/recaptcha-cloudflare?activeTab=readme)
* [@google-cloud/recaptcha-fastly](https://www.npmjs.com/package/@google-cloud/recaptcha-fastly?activeTab=readme)

Bindings that are not yet hosted on NPM should be [downloaded and installed locally](https://docs.npmjs.com/downloading-and-installing-packages-locally).

The base package is available on NPM as [@google-cloud/recaptcha-edge](https://www.npmjs.com/package/@google-cloud/recaptcha-edge) and is intended as an abstraction layer for implementing additional platforms. Platform-specific packages should be used if possible.

Please see the examples and documentation for each binding in the [bindings](https://github.com/GoogleCloudPlatform/recaptcha-edge/tree/main/bindings) directory of choice.

## Contribution

Please see our [Contribution](https://github.com/GoogleCloudPlatform/recaptcha-edge/blob/main/CONTRIBUTING.md) guidelines.

## Issues and Support

For technical issues, please see the [reCAPTCHA Enterprise Support Documentation](https://cloud.google.com/recaptcha/docs/getting-support).

For bugs or issues specifically with this codebase, please open a new [Github issue](https://github.com/GoogleCloudPlatform/recaptcha-edge/issues) in this project.
