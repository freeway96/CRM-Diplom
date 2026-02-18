(() => {
  const initReveal = () => {
    const revealItems = document.querySelectorAll("[data-reveal]");
    if (revealItems.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  };

  const initIndustriesCarousel = () => {
    const carousel = document.querySelector("[data-industries-carousel]");
    if (!carousel) return;

    const track = carousel.querySelector("[data-carousel-track]");
    const dots = Array.from(carousel.querySelectorAll(".carousel-dot"));
    const prevBtn = carousel.querySelector("[data-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-carousel-next]");

    if (!track) return;

    const realSlides = Array.from(track.querySelectorAll(".industry-slide"));
    const realCount = realSlides.length;
    if (realCount < 2) return;

    const firstClone = realSlides[0].cloneNode(true);
    const lastClone = realSlides[realCount - 1].cloneNode(true);
    firstClone.setAttribute("aria-hidden", "true");
    lastClone.setAttribute("aria-hidden", "true");

    track.appendChild(firstClone);
    track.insertBefore(lastClone, track.firstChild);

    let currentIndex = 1;
    let isAnimating = false;
    let autoTimer = null;
    const AUTOPLAY_MS = 5000;
    const TRANSITION = "transform 0.82s cubic-bezier(0.22, 0.61, 0.36, 1)";

    const realIndex = () => (currentIndex - 1 + realCount) % realCount;

    const updateDots = () => {
      const active = realIndex();
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === active);
      });
    };

    const setPosition = (withTransition) => {
      track.style.transition = withTransition ? TRANSITION : "none";
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    };

    const jumpWithoutAnimation = (index) => {
      currentIndex = index;
      setPosition(false);
      void track.offsetHeight;
      track.style.transition = TRANSITION;
    };

    const moveTo = (index) => {
      if (isAnimating) return;
      isAnimating = true;
      currentIndex = index;
      setPosition(true);
      updateDots();
    };

    const next = () => moveTo(currentIndex + 1);
    const prev = () => moveTo(currentIndex - 1);

    const restartAutoplay = () => {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(next, AUTOPLAY_MS);
    };

    const pauseAutoplay = () => {
      if (!autoTimer) return;
      clearInterval(autoTimer);
      autoTimer = null;
    };

    track.addEventListener("transitionend", () => {
      if (currentIndex === 0) {
        jumpWithoutAnimation(realCount);
      } else if (currentIndex === realCount + 1) {
        jumpWithoutAnimation(1);
      }
      isAnimating = false;
      updateDots();
    });

    prevBtn?.addEventListener("click", () => {
      prev();
      restartAutoplay();
    });

    nextBtn?.addEventListener("click", () => {
      next();
      restartAutoplay();
    });

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        const target = index + 1;
        if (target === currentIndex) return;
        moveTo(target);
        restartAutoplay();
      });
    });

    carousel.addEventListener("mouseenter", pauseAutoplay);
    carousel.addEventListener("mouseleave", restartAutoplay);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pauseAutoplay();
        return;
      }
      restartAutoplay();
    });

    setPosition(false);
    updateDots();
    restartAutoplay();
  };

  initReveal();
  initIndustriesCarousel();
})();
