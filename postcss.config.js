export default {
  plugins: {
    // autoprefixer is kept: it emits the -webkit-backdrop-filter prefix that ui.css and
    // overlays.css depend on for Safari. Tailwind was removed because the project uses
    // hand-written CSS with no utility classes.
    autoprefixer: {},
  },
};
