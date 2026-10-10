// The no-flash theme script. Its own file WITHOUT "use client", so a Next.js Server Component
// (app/layout.tsx) can import the string itself — exports of a "use client" module reach server
// code only as client references, not values.
export const THEME_KEY = "theme";
export const themeInitScript =
  `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
