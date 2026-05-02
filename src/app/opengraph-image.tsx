import { ImageResponse } from "next/og";

export const alt =
  "PaperGMX — practice GMX V2 perpetual futures with live prices and no wallet";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/** Social preview card — static OG image for link unfurls. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0f 0%, #12131a 45%, #1a1a2e 100%)",
          padding: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#f4f4f5",
              letterSpacing: -1,
            }}
          >
            PaperGMX
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a1a1aa",
              lineHeight: 1.35,
            }}
          >
            Real GMX V2 prices and fees. Paper USDC. No wallet required.
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#418cf5",
              marginTop: 8,
            }}
          >
            Arbitrum oracle · 4 markets · simulation
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
