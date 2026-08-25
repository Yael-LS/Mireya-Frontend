import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default async function Icon() {
  const filePath = join(process.cwd(), "public", "mireya.jpg");
  const fileBuffer = await readFile(filePath);
  const base64Src = `data:image/jpeg;base64,${fileBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#fff0f3",
        }}
      >
        <img
          src={base64Src}
          alt="Mireya"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}