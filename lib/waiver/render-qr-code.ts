/**
 * PNG / SVG QR output for admin downloads.
 */

import "server-only";
import QRCode from "qrcode";
import { siteConfig } from "@/config/site";

const QR_DARK = `${(siteConfig.theme.darkColor || "#0a1628").replace(/^#/, "")}ff`;

export async function waiverQrToPngBuffer(signUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(signUrl, {
    type: "png",
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: `#${QR_DARK}`, light: "#ffffffff" },
  });
}

export async function waiverQrToSvgString(signUrl: string): Promise<string> {
  return QRCode.toString(signUrl, {
    type: "svg",
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
