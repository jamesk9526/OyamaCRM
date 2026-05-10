// Interactions for the static OyamaCRM marketing demo website.
(function () {
  const menuBtn = document.getElementById("mobileMenuBtn");
  const nav = document.getElementById("mainNav");
  const thumbs = Array.from(document.querySelectorAll(".thumb"));
  const spotlightImage = document.getElementById("spotlightImage");
  const spotlightTitle = document.getElementById("spotlightTitle");
  const spotlightCaption = document.getElementById("spotlightCaption");
  const chips = Array.from(document.querySelectorAll(".chip"));
  const shots = Array.from(document.querySelectorAll(".shot"));
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
  }

  // Update hero spotlight screenshot based on thumbnail selection.
  thumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      thumbs.forEach(function (item) {
        item.classList.remove("active");
      });

      const img = thumb.getAttribute("data-img") || "";
      const title = thumb.getAttribute("data-title") || "";
      const caption = thumb.getAttribute("data-caption") || "";

      spotlightImage.setAttribute("src", img);
      spotlightImage.setAttribute("alt", title);
      spotlightTitle.textContent = title;
      spotlightCaption.textContent = caption;
      thumb.classList.add("active");
    });
  });

  // Filter gallery by product area so the page can be used in tailored demos.
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (item) {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      const filter = chip.getAttribute("data-filter");

      shots.forEach(function (shot) {
        const category = shot.getAttribute("data-category");
        const show = filter === "all" || category === filter;
        shot.classList.toggle("hidden", !show);
      });
    });
  });

  // Use a lightweight image lightbox so screenshots look polished in stakeholder demos.
  function openLightbox(src, caption) {
    lightboxImg.setAttribute("src", src);
    lightboxCaption.textContent = caption;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
  }

  shots.forEach(function (shot) {
    shot.addEventListener("click", function () {
      const image = shot.querySelector("img");
      const title = shot.querySelector("h3");
      if (!image || !title) return;
      openLightbox(image.getAttribute("src") || "", title.textContent || "Screenshot");
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && lightbox.classList.contains("open")) {
      closeLightbox();
    }
  });
})();
