/* eslint-disable */
// Hand-authored, un-bundled browser script served as-is (see the route below), not run
// through this repo's TypeScript/React lint or type-check pipeline, so it intentionally
// opts out of both here rather than fighting rules tuned for app code.
//
// progsu upcoming-shifts embed widget.
//
// Loaded via a plain script tag pointed at this deployment's /api/embed/widget.js route
// (which serves this file's source verbatim). Hand-authored vanilla JavaScript on purpose:
// no build step, no framework, no bundler, so it stays tiny and safe to drop into any
// third-party page. Usage:
//
//   <div id="progsu-shifts"></div>
//   <script src="https://<deployment-host>/api/embed/widget.js"
//           data-target="progsu-shifts"
//           data-count="5"
//           data-event-id=""
//           async></script>
//
// data-target (required): id of the container element to render into.
// data-count (optional): max upcoming shifts to list, default 5, clamped 1-20 to match the
//   endpoint's own clamp.
// data-event-id (optional): filters to one event. Omit (or leave empty) for org-wide
//   upcoming shifts across every published event.
(function () {
  "use strict";

  // document.currentScript must be captured synchronously, right here, before any
  // await/callback/promise runs. Once this script's initial synchronous execution finishes
  // (which happens quickly since the tag carries `async`), document.currentScript reverts
  // to null, so there is no reliable way to recover this reference later.
  var scriptEl = document.currentScript;

  if (!scriptEl) {
    return;
  }

  var targetId = scriptEl.getAttribute("data-target");
  var countAttr = scriptEl.getAttribute("data-count");
  var eventIdAttr = scriptEl.getAttribute("data-event-id");

  if (!targetId) {
    return;
  }

  var targetEl = document.getElementById(targetId);

  if (!targetEl) {
    return;
  }

  // Shadow DOM, open mode: host page styles cannot leak in, and this widget's styles
  // cannot leak out onto the host page.
  var root = targetEl.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    // Reset inherited light-DOM properties (color, font, line-height, ...) that would
    // otherwise cross the shadow boundary even though rules do not.
    ":host { all: initial; }",
    ".progsu-embed {",
    "  display: block;",
    "  box-sizing: border-box;",
    "  background: #0a0a0d;",
    "  color: rgba(245, 245, 250, 0.92);",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  font-size: 13px;",
    "  line-height: 1.4;",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "  border-radius: 12px;",
    "  padding: 12px 14px;",
    "}",
    ".progsu-embed *, .progsu-embed *::before, .progsu-embed *::after { box-sizing: border-box; }",
    ".progsu-embed-list { list-style: none; margin: 0; padding: 0; }",
    ".progsu-embed-item { padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }",
    ".progsu-embed-item:last-child { border-bottom: none; }",
    ".progsu-embed-title { font-weight: 600; color: rgba(245, 245, 250, 0.95); }",
    ".progsu-embed-meta { margin-top: 2px; color: rgba(245, 245, 250, 0.6); font-size: 12px; }",
    ".progsu-embed-time {",
    "  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;",
    "  font-variant-numeric: tabular-nums;",
    "  color: rgba(245, 245, 250, 0.78);",
    "}",
    ".progsu-embed-state { color: rgba(245, 245, 250, 0.6); font-size: 12px; padding: 2px 0; }",
  ].join("\n");
  root.appendChild(style);

  var container = document.createElement("div");
  container.className = "progsu-embed";
  root.appendChild(container);

  function renderState(text) {
    container.textContent = "";
    var state = document.createElement("div");
    state.className = "progsu-embed-state";
    state.textContent = text;
    container.appendChild(state);
  }

  renderState("Loading shifts…");

  var count = parseInt(countAttr, 10);
  if (!count || count < 1) {
    count = 5;
  }
  if (count > 20) {
    count = 20;
  }

  var params = new URLSearchParams();
  params.set("count", String(count));
  if (eventIdAttr) {
    params.set("eventId", eventIdAttr);
  }

  // Resolve against the script's own src (not a hardcoded host) so this works on
  // whatever deployment served the script.
  var endpoint = new URL("/api/public/upcoming-shifts", scriptEl.src).toString() + "?" + params.toString();

  var loggedError = false;

  function handleFailure(error) {
    if (!loggedError) {
      loggedError = true;
      console.error("progsu embed widget: unable to load upcoming shifts", error);
    }
    renderState("Unable to load shifts right now.");
  }

  try {
    fetch(endpoint)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("upcoming-shifts request failed with status " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        var shifts = (payload && payload.shifts) || [];

        if (shifts.length === 0) {
          renderState("No upcoming shifts.");
          return;
        }

        var timeFormatter = new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        var list = document.createElement("ul");
        list.className = "progsu-embed-list";

        shifts.forEach(function (shift) {
          var item = document.createElement("li");
          item.className = "progsu-embed-item";

          var titleEl = document.createElement("div");
          titleEl.className = "progsu-embed-title";
          titleEl.textContent = shift && shift.title ? shift.title : "Untitled shift";
          item.appendChild(titleEl);

          var metaEl = document.createElement("div");
          metaEl.className = "progsu-embed-meta";

          var timeEl = document.createElement("span");
          timeEl.className = "progsu-embed-time";
          var startDate = shift && shift.startsAt ? new Date(shift.startsAt) : null;
          timeEl.textContent =
            startDate && !isNaN(startDate.getTime()) ? timeFormatter.format(startDate) : "Time TBD";
          metaEl.appendChild(timeEl);

          var needed = shift && typeof shift.needed === "number" ? shift.needed : 0;
          var filled = shift && typeof shift.filled === "number" ? shift.filled : 0;
          var stationSuffix = shift && shift.stationName ? " · " + shift.stationName : "";
          var restEl = document.createElement("span");
          restEl.textContent = stationSuffix + " · " + filled + "/" + needed + " filled";
          metaEl.appendChild(restEl);

          item.appendChild(metaEl);

          // Not rendering a click-through link yet: the public schedule page lives at
          // /s/[token] and is reached only via a share token (docs/contracts/public.md
          // section 5, "Embed widget"), and a share token cannot be resolved from an
          // event id alone today (share_tokens does not exist yet, see
          // docs/contracts/schema-requests.md). Once an event -> active share token
          // lookup exists, wrap `item` in an <a href="/s/<token>"> here.
          list.appendChild(item);
        });

        container.textContent = "";
        container.appendChild(list);
      })
      .catch(handleFailure);
  } catch (error) {
    // fetch itself can throw synchronously in some hosts (e.g. disallowed by a strict
    // page CSP); keep this from ever bubbling out of the widget into the host page.
    handleFailure(error);
  }
})();
