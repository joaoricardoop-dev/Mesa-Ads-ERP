import { forwardRef, useMemo } from "react";
import * as THREE from "three";

export interface CoasterVariant {
  color: string;
  ink?: string;
  label: string | string[];
  footer?: string;
  backLabel?: string | string[];
  backColor?: string;
  backInk?: string;
}

interface Props {
  variant?: CoasterVariant;
  artFront?: THREE.Texture | null;
  artBack?: THREE.Texture | null;
  radius?: number;
  thickness?: number;
}

function drawMultilineCentered(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  const total = lines.length;
  const startY = y - ((total - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
}

function buildFrontTexture(variant: CoasterVariant): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = variant.color;
  ctx.fillRect(0, 0, 1024, 1024);

  const ink = variant.ink ?? "#0A0A0C";
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(512, 512, 470, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const lines = Array.isArray(variant.label) ? variant.label : variant.label.split("\n");
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = lines.length <= 1 ? 140 : lines.length === 2 ? 120 : 96;
  ctx.font = `900 ${fontSize}px "Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif`;
  drawMultilineCentered(ctx, lines, 512, 512, fontSize * 1.08);

  if (variant.footer) {
    ctx.font = '600 40px "Bricolage Grotesque Variable", system-ui, sans-serif';
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.75;
    ctx.fillText(variant.footer, 512, 900);
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBackTexture(variant: CoasterVariant): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;

  const bg = variant.backColor ?? "#0A0A0C";
  const fg = variant.backInk ?? "#F5F5F3";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(512, 512, 470, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(372, 372);
  ctx.fillStyle = fg;
  const cells = 12;
  const size = 280;
  const cell = size / cells;
  const pattern = [
    0b111111111111, 0b100000000001, 0b101110111001, 0b101011101001, 0b101011101001,
    0b100000000001, 0b111111111111, 0b001010101011, 0b110101010100, 0b010111110011,
    0b101010001011, 0b111111111111,
  ];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if ((pattern[r] >> (cells - 1 - c)) & 1) ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1);
    }
  }
  ctx.restore();

  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const labelSrc = variant.backLabel ?? variant.footer ?? "mesa.ads";
  const lines = Array.isArray(labelSrc) ? labelSrc : labelSrc.split("\n");
  ctx.font = '800 72px "Bricolage Grotesque Variable", system-ui, sans-serif';
  drawMultilineCentered(ctx, lines, 512, 800, 80);

  ctx.font = '500 28px "Bricolage Grotesque Variable", system-ui, sans-serif';
  ctx.globalAlpha = 0.6;
  ctx.fillText("aponte a câmera", 512, 880);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Coaster3D = forwardRef<THREE.Group, Props>(function Coaster3D(
  { variant, artFront, artBack, radius = 0.9, thickness = 0.06 },
  ref,
) {
  const frontTexture = useMemo(() => {
    if (artFront) return artFront;
    if (!variant) return null;
    return buildFrontTexture(variant);
  }, [artFront, variant]);

  const backTexture = useMemo(() => {
    if (artBack) return artBack;
    if (!variant) return null;
    return buildBackTexture(variant);
  }, [artBack, variant]);

  const frontMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.5, metalness: 0.06 }),
    [frontTexture],
  );
  const backMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.55, metalness: 0.06 }),
    [backTexture],
  );
  const rimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(variant?.color ?? "#0A0A0C"),
        roughness: 0.85,
      }),
    [variant?.color],
  );

  return (
    <group ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={rimMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, thickness, 64, 1, true]} />
      </mesh>
      <mesh
        position={[0, thickness / 2 + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={frontMaterial}
        castShadow
      >
        <circleGeometry args={[radius, 64]} />
      </mesh>
      <mesh
        position={[0, -thickness / 2 - 0.001, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={backMaterial}
        castShadow
      >
        <circleGeometry args={[radius, 64]} />
      </mesh>
    </group>
  );
});
