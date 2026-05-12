// OyamaCRM Compassion scheduler embed script.
(function () {
  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var token = (scriptEl.getAttribute("data-token") || "").trim();
  if (!token) {
    console.error("[OyamaCRM] Missing data-token for compassion scheduler embed.");
    return;
  }

  var targetId = (scriptEl.getAttribute("data-target") || "").trim();
  var mode = (scriptEl.getAttribute("data-mode") || "inline").trim().toLowerCase();
  var buttonLabel = (scriptEl.getAttribute("data-button-label") || "Book Appointment").trim();
  var height = (scriptEl.getAttribute("data-height") || "780").trim();
  var borderRadius = (scriptEl.getAttribute("data-radius") || "14").trim();

  var scriptUrl = new URL(scriptEl.src, window.location.href);
  var appOrigin = scriptUrl.origin;
  var widgetUrl = appOrigin + "/compassion/public/appointments/" + encodeURIComponent(token);

  var target = null;
  if (targetId) {
    target = document.getElementById(targetId);
  }
  if (!target) {
    target = scriptEl.parentElement;
  }
  if (!target) {
    console.error("[OyamaCRM] Could not resolve target element for compassion scheduler embed.");
    return;
  }

  function buildIframe() {
    var iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.title = "Compassion Appointment Request";
    iframe.style.width = "100%";
    iframe.style.height = /^\d+$/.test(height) ? height + "px" : height;
    iframe.style.border = "0";
    iframe.style.borderRadius = /^\d+$/.test(borderRadius) ? borderRadius + "px" : borderRadius;
    iframe.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.12)";
    iframe.loading = "lazy";
    return iframe;
  }

  if (mode === "popup") {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = buttonLabel;
    button.style.border = "0";
    button.style.borderRadius = "10px";
    button.style.padding = "12px 18px";
    button.style.fontSize = "14px";
    button.style.fontWeight = "600";
    button.style.cursor = "pointer";
    button.style.background = "#2563eb";
    button.style.color = "#ffffff";

    var overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15, 23, 42, 0.55)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "2147483650";

    var modal = document.createElement("div");
    modal.style.width = "100%";
    modal.style.maxWidth = "980px";
    modal.style.maxHeight = "96vh";
    modal.style.background = "#ffffff";
    modal.style.borderRadius = "14px";
    modal.style.overflow = "hidden";

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.style.border = "0";
    close.style.background = "#f1f5f9";
    close.style.color = "#0f172a";
    close.style.padding = "8px 12px";
    close.style.fontSize = "12px";
    close.style.cursor = "pointer";

    var frameWrap = document.createElement("div");
    frameWrap.style.padding = "8px";
    var frame = buildIframe();
    frame.style.height = "82vh";
    frameWrap.appendChild(frame);

    close.addEventListener("click", function () {
      overlay.style.display = "none";
    });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        overlay.style.display = "none";
      }
    });
    button.addEventListener("click", function () {
      overlay.style.display = "flex";
    });

    modal.appendChild(close);
    modal.appendChild(frameWrap);
    overlay.appendChild(modal);

    target.appendChild(button);
    document.body.appendChild(overlay);
    return;
  }

  target.innerHTML = "";
  target.appendChild(buildIframe());
})();
