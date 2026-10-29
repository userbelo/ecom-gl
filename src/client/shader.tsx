import React from "react";
import { createRoot } from "react-dom/client";
import { Warp } from "@paper-design/shaders-react";

function NewsletterBackground() {
  return (
    <Warp
      style={{ height: "100%", width: "100%" }}
      proportion={0.45}
      softness={1}
      distortion={0.25}
      swirl={0.8}
      swirlIterations={10}
      shape="checks"
      shapeScale={0.1}
      scale={1}
      rotation={0}
      speed={1}
      colors={[
        "hsl(340, 100%, 20%)",
        "hsl(320, 100%, 75%)",
        "hsl(350, 90%, 30%)",
        "hsl(330, 100%, 80%)",
      ]}
    />
  );
}

export function mountShader() {
  const container = document.querySelector("#newsletter-background");
  if (container && !container.hasChildNodes()) {
    createRoot(container).render(<NewsletterBackground />);
  }
}
