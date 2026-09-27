import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCurrentPerson } from "@/lib/auth";
import { getBoard } from "@/lib/board";
import { n1 } from "@/lib/format";

// Read once at module scope — the fonts don't depend on the request.
const archivo = await readFile(join(process.cwd(), "assets/Archivo-SemiBold.ttf"));
const monoRegular = await readFile(join(process.cwd(), "assets/JetBrainsMono-Regular.ttf"));
const monoBold = await readFile(join(process.cwd(), "assets/JetBrainsMono-Bold.ttf"));

const CASE = "#17150F";
const EDGE = "#332E22";
const LCD = "#0B120E";
const AMBER = "#E8B33A";
const AMBER_DIM = "#8A6C22";
const INK = "#EDE6D4";
const MUTED = "#8A8272";
const LOW = "#D9542B";

const WIDTH = 900;
const ROW_H = 86;

export async function GET() {
  const admin = await getCurrentPerson();
  if (!admin) return new Response("Not signed in.", { status: 401 });
  if (!admin.is_admin) return new Response("Admin only.", { status: 403 });

  const { rows, total } = await getBoard();

  if (rows.length === 0) {
    return new Response("Nobody is on the meter yet.", { status: 400 });
  }

  const dated = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const height = 56 + 96 + 28 + (28 + rows.length * ROW_H + 28) + 96 + 40;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: CASE,
          padding: "40px 44px",
          fontFamily: "Archivo",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderBottom: `1px solid ${EDGE}`,
            paddingBottom: 22,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 17,
                letterSpacing: 3,
                color: MUTED,
              }}
            >
              SHARED PREPAID METER
            </div>
            <div
              style={{
                fontSize: 46,
                fontWeight: 600,
                color: INK,
                marginTop: 8,
                letterSpacing: -1,
              }}
            >
              Units
            </div>
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono",
              fontSize: 20,
              color: MUTED,
              paddingBottom: 6,
            }}
          >
            {dated}
          </div>
        </div>

        {/* the readout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: LCD,
            border: "1px solid #000",
            borderRadius: 10,
            marginTop: 28,
            padding: "28px 30px",
          }}
        >
          {rows.map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: ROW_H,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 27,
                    color: INK,
                  }}
                >
                  {r.name}
                  {r.low && (
                    <div
                      style={{
                        fontFamily: "JetBrains Mono",
                        fontSize: 15,
                        letterSpacing: 2,
                        color: LOW,
                        border: `1px solid ${LOW}`,
                        borderRadius: 4,
                        padding: "3px 8px",
                        marginLeft: 14,
                      }}
                    >
                      LOW
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "JetBrains Mono",
                    fontSize: 14,
                    color: MUTED,
                    marginTop: 6,
                  }}
                >
                  {n1(r.loaded)} loaded · {n1(r.reading)} on meter
                </div>
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono",
                  fontWeight: 700,
                  fontSize: 38,
                  color: r.low ? LOW : AMBER,
                }}
              >
                {n1(r.balance)}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `1px solid ${EDGE}`,
            marginTop: 28,
            paddingTop: 24,
          }}
        >
          <div
            style={{
              fontFamily: "JetBrains Mono",
              fontSize: 17,
              letterSpacing: 3,
              color: AMBER_DIM,
            }}
          >
            UNITS LEFT · IN THE HOUSE
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono",
              fontWeight: 700,
              fontSize: 34,
              color: INK,
            }}
          >
            {n1(total)}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: "Archivo", data: archivo, weight: 600, style: "normal" },
        { name: "JetBrains Mono", data: monoRegular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: monoBold, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "no-store" },
    }
  );
}
