# 3suite-mock-server

mock-server is a configurable server that sends a response to any request, either in JSON or file format.

mock-server is useful for responding to apps that expect complex response (AKA AI generation endpoinds) that happen after some delay.

for configuration, see the [configuration file](./config.toml), and refer to the [3lib-config library docs](https://github.com/3sig/3lib-config)

### macOS builds

we currently do not support notarization for macOS builds.
to run mac builds, flag them as safe for gatekeeper with the following command:

`xattr -c <path_to_mac_executable>`
