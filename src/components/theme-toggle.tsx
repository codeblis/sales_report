"use client";

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("rv:theme", dark ? "dark" : "light");
    } catch {
      /* sin persistencia */
    }
  };
  return (
    <button className="btn" type="button" onClick={toggle}>
      <span className="ico" aria-hidden="true">
        ☀
      </span>
      <span>Tema</span>
    </button>
  );
}
