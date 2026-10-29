import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Warp } from "@paper-design/shaders-react";
import { startIntro } from "./app";

const desktopGif = "/assets/intro/desktop.gif";
const mobileGif = "/assets/intro/mobile.gif";

function Newsletter() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("form");
  const [firstName, setFirstName] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (stage !== "form") return;

    const fullName = name.trim();
    const mobile = phone.trim();
    const digits = mobile.replace(/\D/g, "");

    if (!fullName || fullName.length > 100) {
      setError("Informe seu nome para continuar.");
      return;
    }
    if (!/^[\d\s()+.-]+$/.test(mobile) || digits.length < 10 || digits.length > 13) {
      setError("Informe um celular válido com DDD.");
      return;
    }
    if (!consent) {
      setError("Autorize o uso dos seus dados para continuar.");
      return;
    }

    setError("");
    setStage("saving");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, phone: mobile, consent: true }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar seus dados.");
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar seus dados. Tente novamente.",
      );
      setStage("form");
      return;
    }

    setFirstName(fullName.split(/\s+/)[0]);
    setStage("welcome");

    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    try {
      await startIntro({ desktopGif, mobileGif });
    } catch (animationError) {
      setError(
        animationError instanceof Error
          ? animationError.message
          : "Não foi possível carregar a animação.",
      );
      setStage("welcome");
    }
  }

  return (
    <main className="newsletter-screen">
      <div className="newsletter-background" aria-hidden="true">
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
      </div>

      <section className="newsletter-content">
        <div className="newsletter-inner" aria-live="polite">
          {stage === "welcome" ? (
            <>
              <p className="newsletter-brand">REHVA</p>
              <h1 className="newsletter-title">
                Welcome, <span>{firstName}</span>!
              </h1>
              <p className="newsletter-description">
                Your REHVA experience is ready.
                <br />
                Get ready for something made just for you.
              </p>
              {error && (
                <p className="newsletter-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="newsletter-title">Coming Soon</h1>

              <form
                className="newsletter-form"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="newsletter-fields">
                  <label className="visually-hidden" htmlFor="lead-name">
                    Your name
                  </label>
                  <input
                    id="lead-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    maxLength={100}
                    value={name}
                    disabled={stage === "saving"}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError("");
                    }}
                    required
                  />
                  <span className="newsletter-divider" aria-hidden="true" />
                  <label className="visually-hidden" htmlFor="lead-phone">
                    Your mobile number
                  </label>
                  <input
                    id="lead-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Mobile number"
                    maxLength={20}
                    value={phone}
                    disabled={stage === "saving"}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setError("");
                    }}
                    required
                  />
                </div>

                <button
                  className="newsletter-submit"
                  type="submit"
                  disabled={stage === "saving"}
                  aria-label="Continue"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 5l7 7-7 7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>

              <label className="newsletter-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={stage === "saving"}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setError("");
                  }}
                  required
                />
                <span>
                  I agree that REHVA may use my details to contact me with
                  news and updates.
                </span>
              </label>

              {error && (
                <p className="newsletter-error" role="alert">
                  {error}
                </p>
              )}

              <p className="newsletter-description">
                Don&apos;t miss out on the latest news and special content!
                <br />
                Sign up for our newsletter now and stay in the loop with every
                update.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("welcome-root")).render(<Newsletter />);
