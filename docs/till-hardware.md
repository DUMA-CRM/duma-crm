# Till hardware — first implementation

Till hardware is an optional connector contributed by the `pos` module. Find it in
Settings → Connectors → Till hardware or Settings → Configuration → Till.
Configuration and physical test actions require `settings:write`. Cash payments
continue working with no connector.

## Register scope

One register configuration is saved per browser profile, workspace and location
in `duma-till-hardware` localStorage. It includes a stable register UUID, display
name, adapter, exact printer name, drawer wiring/timings, physical test confirmation
and explicit automatic-open preference. Configure each counter on its own device.
This is not a server register inventory: configuration is not synced across devices
and clearing browser data removes it. The UUID is a local identifier, not a trusted
server authorization credential.

## iPad receipts and drawer control

AirPrint is the receipt path on iPad: the existing receipt action opens the PDF;
the operator chooses Share → Print, selects an AirPrint printer and confirms.
AirPrint does not supply a separate browser drawer-open API. Some printers can
kick their drawer for every AirPrint job; disable that printer setting when using
cash-only drawer control, or card receipts and reprints may also open it.

The `epson-epos` adapter sends Epson ePOS-Print XML from Safari directly to a
compatible network printer, independently of AirPrint. The iPad and printer must
be on the same reachable network. The printer must have ePOS-Print enabled and
HTTPS with a certificate trusted on the iPad (including a matching hostname/IP).
The firmware must accept cross-origin ePOS requests from the app, and browser/local
network permissions must permit the connection. AirPrint support alone is not
sufficient. USB/Bluetooth-only and arbitrary network printers are not supported by
this adapter. No desktop helper is required for this path.

The business adds its printer itself, in Settings → Connections → Till hardware:
enter the printer's address (for example `192.168.1.20` or `printer.local`),
check the connection, print a test slip, test the drawer, and save. No deployment
configuration is involved.

Addresses are normalised by `normalisePrinterAddress`
(`lib/pos-hardware/network-policy.ts`) to an HTTPS origin on a local network:
RFC 1918 or link-local IPv4, unique-local IPv6, `.local` / `.lan` / `.home.arpa` /
`.internal` names, or a single-label name. A pasted URL (for example the printer's
own web page) keeps only its origin, and a portless `http://` address becomes its
`https://` origin. An `http://` address with a port, credentials, other schemes,
wildcards and public hosts are refused. Requests never fall back to HTTP and never
follow redirects.

There is no automatic discovery: browsers expose no mDNS/LAN discovery, and
probing the network would need every candidate origin in the CSP. Instead, the
step offers printers already used by this browser's other tills, and a short
guide (status sheet, router device list, Epson TM Utility).

**CSP.** `connect-src` must name the printer's origin, and a document's policy is
fixed when it loads. The till hardware store mirrors this browser's saved printer
origins into the `duma-till-printers` cookie (at most 8). `proxy.ts` re-validates
the cookie with the same local-network rule and adds only those origins to this
browser's `connect-src`. A tampered cookie therefore cannot open the policy to a
public host. The first check of an address the current page does not allow writes
the cookie and reloads once, keeping the draft and wizard step in sessionStorage
(`printer-access.ts` reads the page's allowed origins before anything rewrites
the cookie). The cookie is restored from localStorage on every load.

The device ID normally defaults to `local_printer`. Check connection sends an empty
ePOS print document (no feed or pulse). Test receipt and drawer opening are separate
commands. The response must be successful ePOS XML; HTTP 200 alone is not success.
A 15-second timeout retains the dispatch claim because delivery may be ambiguous.
Epson pulse durations are 100, 200, 300, 400 or 500 ms; its API controls off timing.
Test with the actual iPadOS/Safari and printer/firmware before claiming hardware
compatibility. No physical hardware was available during implementation.

## QZ Tray adapter

Install QZ Tray 2.2 or later on a desktop till and configure an ESC/POS receipt
printer for raw printing. Discover printers, select one, and print a test slip.
For a printer-connected drawer, check the manufacturer's cable, voltage, pin and
pulse specifications. Test opening it, confirm it physically opened, then enable
opening after cash payments and save. Changing the printer, connector, drawer
mode, pin or pulse timing invalidates that confirmation and disables auto-open.

QZ's trust prompts are retained. This version does not offer silent operation;
that requires a trusted QZ certificate and a properly authorized server-side
message signer. No private signing key belongs in the browser. This adapter is
not an iPad/Android integration.

The adapter uses TLS localhost WebSockets only. The CSP permits the four QZ secure
ports (8181, 8282, 8383, 8484), including when navigating into the till client-side.
There is no arbitrary network host setting or insecure socket fallback. The browser
may require local-network permission in addition to QZ's prompts.

Drawer commands use ESC p encoded as raw hex so high-byte pulse timings cannot be
changed by a text encoding. The adapter matches the exact configured printer;
there is no fallback to a default printer. Sending a command is not evidence that
the physical drawer opened. Normal sales receipts still use the browser print
flow, independently of the drawer.

## Payment boundary and failures

The charge session captures the hardware configuration and workspace/location.
Only a successful online cash-payment confirmation invokes the adapter. Selecting
cash, failed/pending payments, cards, receipt prints, offline sales and queue replay
do not. Offline cash completion explains that the drawer needs manual opening.

Before dispatch, a Web Lock serializes a durable localStorage claim keyed by scope
and payment ID across tabs. The claim is written before touching the hardware and
is retained even after an error, because a disconnected printer may already have
received the command. Automatic retry is deliberately avoided. Storage or lock
failure prevents dispatch. Claims are not evicted and survive refresh; clearing
browser data removes this protection. This is not an exactly-once physical-delivery
guarantee or protection across multiple browser profiles.

The payment is completed before dispatch. Hardware errors update the completion
screen and cannot turn a recorded payment into a failed sale. Operators can open
the drawer manually. A no-sale cashier button is intentionally not included yet:
it needs a dedicated authorization and server audit flow. Settings tests are local
administrative setup actions, not a server-audited cash movement log.

## Validation and follow-up

Unit tests cover cash-only dispatch, opt-in, duplicate claims, ambiguous errors,
storage errors, unsupported/unverified configurations and pulse encoding bounds.
They use the production dispatcher with an injected adapter; they do not prove
WebSocket connectivity, printer delivery or physical opening. Verify those on the
first customer's selected hardware before production rollout.

Next steps for production rollout: validate the chosen iPad/Epson hardware and TLS
setup, trusted QZ message signing for desktop, server-managed register inventory, audited no-sale opening, and further adapters as needed. Hardware-dependent offline opening should be designed
alongside signing/offline authorization rather than being triggered by later sync.

References:
- https://qz.io/docs/getting-started
- https://qz.io/docs/raw
- https://qz.io/docs/signing
- https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_lp.html

- https://support.apple.com/en-ie/109349
- https://www.starasia.com/Download/Manual/AirPrint_Users_Manual.pdf
- https://files.support.epson.com/pdf/pos/bulk/epos-print_xml_um_en_rev_af.pdf
