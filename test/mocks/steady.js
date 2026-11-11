// For test/shots.js only: no background top-ups. Whether the planner tops a city's list up (more ideas) depends on what it had picked when the city's lists finished coming in, which follows timing; the screenshots
// show each city's own lists, so two runs on the same code give the same pictures. (The planner's top-ups have tests of
// their own.) Set as soon as the app has defined them, long before any list comes in.
(() => {
  const t = setInterval(() => {
    const W = window.W; if (!W || !W.loadCity) return;
    clearInterval(t);
    const city = W.loadCity; W.loadCity = function (country, name, more) { if (more) return; return city.apply(this, arguments); };
    W.mealIdeas = function () { return ''; };   /* (places for a meal left empty: test/suites/meals.js) */
  }, 0);
})();
