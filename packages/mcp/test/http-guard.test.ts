import { describe, test, expect } from "vitest";
import { isRequestOriginAllowed } from "../src/transports/http-guard.js";

// I4: the MCP HTTP endpoint accepted any request with no Origin/Host checks,
// exposing all 13 tools to DNS-rebinding attacks from a browser page. Requests
// must be validated: same-origin loopback Host is allowed; a cross-site Origin
// header is rejected unless explicitly allow-listed.

describe("isRequestOriginAllowed (I4)", () => {
  const allowedHosts = ["127.0.0.1:4568", "localhost:4568"];

  test("allows a request with no Origin (non-browser client) to a loopback Host", () => {
    expect(
      isRequestOriginAllowed({ origin: undefined, host: "127.0.0.1:4568" }, { allowedHosts }),
    ).toBe(true);
  });

  test("rejects a request to an unexpected Host (DNS rebinding)", () => {
    expect(
      isRequestOriginAllowed({ origin: undefined, host: "evil.example.com" }, { allowedHosts }),
    ).toBe(false);
  });

  test("rejects a cross-site Origin even with a valid Host", () => {
    expect(
      isRequestOriginAllowed(
        { origin: "https://evil.example.com", host: "127.0.0.1:4568" },
        { allowedHosts },
      ),
    ).toBe(false);
  });

  test("allows a same-origin loopback Origin", () => {
    expect(
      isRequestOriginAllowed(
        { origin: "http://127.0.0.1:4568", host: "127.0.0.1:4568" },
        { allowedHosts },
      ),
    ).toBe(true);
  });

  test("allows an explicitly allow-listed Origin", () => {
    expect(
      isRequestOriginAllowed(
        { origin: "https://wiki.example.com", host: "127.0.0.1:4568" },
        { allowedHosts, allowedOrigins: ["https://wiki.example.com"] },
      ),
    ).toBe(true);
  });
});
