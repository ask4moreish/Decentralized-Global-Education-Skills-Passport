import React, { useEffect, useState } from "react";
import { LearnerHub } from "../passport/LearnerHub";
import { IssuerConsole } from "../passport/IssuerConsole";
import { EmployerVerifier } from "../passport/EmployerVerifier";
import { passportTabFromHash, type PassportTab } from "../config/routing";
import { LOGO_SRC } from "../lib/chain";

export type { PassportTab };
export { passportTabFromHash };

export function PassportPage({ goHome }: { goHome: () => void }) {
  const [activeTab, setActiveTab] = useState<PassportTab>(() => passportTabFromHash());

  useEffect(() => {
    const onHash = () => setActiveTab(passportTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function selectTab(tab: PassportTab) {
    setActiveTab(tab);
    const targetHash =
      tab === "verifier"
        ? "#/passport/verify"
        : tab === "issuer"
        ? "#/passport/issuer"
        : "#/passport/learner";
    if (typeof window !== "undefined" && window.location.hash !== targetHash) {
      window.history.replaceState(null, "", targetHash);
    }
  }

  return (
    <div className="passport-page-container">
      {/* Top Header */}
      <header className="passport-header">
        <div className="header-left">
          <button type="button" className="brand-button" onClick={goHome}>
            <img src={LOGO_SRC} alt="" className="brand-logo" />
            <span className="brand-title">
              Decentralized Global Education & Skills Passport
            </span>
          </button>
          <span className="network-tag">Stellar Soroban</span>
        </div>

        <div className="header-right">
          <nav className="passport-nav-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "learner" ? "active" : ""}`}
              onClick={() => selectTab("learner")}
            >
              🎓 Learner Passport
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "issuer" ? "active" : ""}`}
              onClick={() => selectTab("issuer")}
            >
              🏛️ Institution Portal
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "verifier" ? "active" : ""}`}
              onClick={() => selectTab("verifier")}
            >
              🔍 Employer Verifier
            </button>
          </nav>

          <a href="#/demo/grants" className="secondary-action compact">
            ⚖️ Allocation Demo
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="passport-main">
        {activeTab === "learner" && <LearnerHub />}
        {activeTab === "issuer" && <IssuerConsole />}
        {activeTab === "verifier" && <EmployerVerifier />}
      </main>

      {/* Footer */}
      <footer className="passport-footer">
        <div className="footer-content">
          <p>
            Decentralized Global Education & Skills Passport · Built on Stellar Soroban Protocol 22+
          </p>
          <div className="footer-links">
            <a href="#/landing">Overview</a>
            <span>·</span>
            <a href="#/architecture">Architecture</a>
            <span>·</span>
            <a href="#/verify">Receipt Verifier</a>
            <span>·</span>
            <a
              href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
