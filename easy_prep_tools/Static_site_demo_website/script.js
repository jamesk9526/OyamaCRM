/* OyamaCRM marketing site interactions for hero switching, filters, mobile nav, and lightbox. */
(function () {
  const mobileToggle = document.getElementById("mobileToggle");
  const topbarNav = document.getElementById("topbarNav");
  const heroScreenshot = document.getElementById("heroScreenshot");
  const heroShotTitle = document.getElementById("heroShotTitle");
  const heroShotMeta = document.getElementById("heroShotMeta");
  const heroChips = Array.from(document.querySelectorAll(".hero-chip"));
  const filterChips = Array.from(document.querySelectorAll(".filter-chip"));
  const shotCards = Array.from(document.querySelectorAll(".shot-card"));

  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");

  let activeShots = shotCards.slice();
  let activeIndex = 0;

  function syncHero(button) {
    if (!button || !heroScreenshot) return;

    heroChips.forEach((chip) => chip.classList.toggle("active", chip === button));
    heroScreenshot.src = button.dataset.src || heroScreenshot.src;
    heroScreenshot.alt = button.dataset.title || heroScreenshot.alt;

    if (heroShotTitle) {
      heroShotTitle.textContent = button.dataset.title || "OyamaCRM";
    }

    if (heroShotMeta) {
      heroShotMeta.textContent = button.dataset.meta || "";
    }
  }

  function syncActiveShots() {
    activeShots = shotCards.filter((card) => !card.classList.contains("hidden"));
  }

  function openLightbox(index) {
    syncActiveShots();
    activeIndex = Math.max(0, Math.min(index, activeShots.length - 1));
    const card = activeShots[activeIndex];
    if (!card) return;

    const image = card.querySelector("img");
    const title = card.querySelector("figcaption span");
    const meta = card.querySelector("figcaption small");
    if (!image || !lightboxImage) return;

    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = [title?.textContent || "", meta?.textContent || ""].filter(Boolean).join(" - ");
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function moveLightbox(step) {
    syncActiveShots();
    if (!activeShots.length) return;
    activeIndex = (activeIndex + step + activeShots.length) % activeShots.length;
    openLightbox(activeIndex);
  }

  heroChips.forEach((chip) => {
    chip.addEventListener("click", () => syncHero(chip));
  });

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter || "all";
      filterChips.forEach((item) => item.classList.toggle("active", item === chip));
      shotCards.forEach((card) => {
        const category = card.dataset.category || "all";
        const matches = filter === "all" || filter === category;
        card.classList.toggle("hidden", !matches);
      });
      syncActiveShots();
    });
  });

  shotCards.forEach((card) => {
    card.addEventListener("click", () => {
      syncActiveShots();
      openLightbox(activeShots.indexOf(card));
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener("click", () => moveLightbox(-1));
  }

  if (lightboxNext) {
    lightboxNext.addEventListener("click", () => moveLightbox(1));
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
  }

  if (mobileToggle && topbarNav) {
    mobileToggle.addEventListener("click", () => {
      const open = topbarNav.classList.toggle("open");
      mobileToggle.setAttribute("aria-expanded", String(open));
    });

    topbarNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        topbarNav.classList.remove("open");
        mobileToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
  });
})();
