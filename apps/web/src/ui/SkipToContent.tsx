/**
 * Accessibility skip-to-content link.
 * Hidden by default, visible on keyboard focus (Tab).
 * Allows keyboard users to skip directly to the main content area.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-content"
      onClick={(e) => {
        e.preventDefault();
        const main = document.querySelector("main");
        if (main) {
          main.setAttribute("tabindex", "-1");
          main.focus();
          // Remove the negative tabindex after focus so normal tab flow resumes
          main.addEventListener(
            "blur",
            () => {
              main.removeAttribute("tabindex");
            },
            { once: true },
          );
        }
      }}
    >
      Skip to main content
    </a>
  );
}
