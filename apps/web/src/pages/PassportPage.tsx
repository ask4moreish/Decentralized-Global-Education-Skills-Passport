import React, { useState } from "react";
import { LearnerHub } from "../passport/LearnerHub";
import { IssuerConsole } from "../passport/IssuerConsole";
import { EmployerVerifier } from "../passport/EmployerVerifier";
import { LOGO_SRC } from "../lib/chain";

export type PassportTab = "learner" | "issuer" | "verifier";

export function PassportPage({ goHome }: { goHome: () => void }) {
  const [activeTab, setActiveTab] = useState<PassportTab>("learner");

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
              onClick={() => setActiveTab("learner")}
            >
              🎓 Learner Passport
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "issuer" ? "active" : ""}`}
              onClick={() => setActiveTab("issuer")}
            >
              🏛️ Institution Portal
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === "verifier" ? "active" : ""}`}
              onClick={() => setActiveTab("verifier")}
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
