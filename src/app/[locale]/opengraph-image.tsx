import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const runtime = "edge";
export const alt = "KolMatrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OpengraphImage({ params }: Props): Promise<ImageResponse> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1326 0%, #131b2e 100%)",
          color: "#dae2fd",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: "#9cf0ff",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          KolMatrix
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            maxWidth: "900px",
          }}
        >
          {t("meta.title")}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 24,
            color: "#bac9cc",
            maxWidth: "900px",
            lineHeight: 1.4,
          }}
        >
          {t("meta.description")}
        </div>
        <div
          style={{
            marginTop: 40,
            height: 4,
            width: 120,
            background: "#00E5FF",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    size,
  );
}
