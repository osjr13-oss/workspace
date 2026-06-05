type PwaIconMarkupProps = {
  size: number;
  maskable?: boolean;
};

export function PwaIconMarkup({ size, maskable }: PwaIconMarkupProps) {
  const pad = maskable ? size * 0.22 : size * 0.16;
  const inner = size - pad * 2;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f5f0"
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: inner * 0.24,
          background: "#1b2d50",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fffefa",
          fontSize: inner * 0.46,
          fontWeight: 800,
          fontFamily: "Segoe UI, system-ui, sans-serif",
          letterSpacing: "-0.04em"
        }}
      >
        S
      </div>
    </div>
  );
}
