document.getElementById("extract").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProfileInfo });
});

document.getElementById("downloadPdf").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: saveProfileAsPDF });
});

function extractProfileInfo() {
  /* helpers local to injected context */
  const waitForSelector = (selector, maxRetries = 15, interval = 200) => new Promise(res => {
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el || ++tries >= maxRetries) { clearInterval(timer); res(el); }
    }, interval);
  });

  const firstLine = (txt = "") => txt?.split("\n")[0].trim() || "";
  const cleanDate = (raw = "") => {
    let txt = raw.split("·")[0];
    txt = txt.replace(/^(De|Du|d’|d')\s+/i, "");
    txt = txt.replace(/\s+à\s+/i, " - ");
    return firstLine(txt);
  };
  const clickIfExists = async selector => {
    const btn = document.querySelector(selector);
    if (btn) { btn.click(); await new Promise(r => setTimeout(r, 500)); }
  };

  (async () => {
    /* ---------- NAME ---------- */
    let name = "";
    const headingEl = await waitForSelector(".text-heading-xlarge");
    if (headingEl) name = headingEl.innerText.trim();
    if (!name) {
      const imgEl = await waitForSelector(".pv-top-card-profile-picture__image") ||
                    await waitForSelector(".pv-top-card-profile-picture__image--show") ||
                    await waitForSelector(".profile-photo-edit__preview");
      if (imgEl) name = imgEl.getAttribute("alt")?.trim() || imgEl.getAttribute("title")?.trim() || "";
    }
    if (!name) {
      const metaTitle = document.querySelector('meta[property="og:title"]')?.content;
      if (metaTitle) name = metaTitle.split(" | ")[0].trim();
    }
    if (!name) {
      const docTitle = document.title;
      name = docTitle.includes("|") ? docTitle.split("|")[0].trim() : docTitle.trim();
    }

    /* ---------- PHOTO ---------- */
    let photo = "";
    const photoEl = await waitForSelector(".pv-top-card-profile-picture__image") ||
                    await waitForSelector(".pv-top-card-profile-picture__image--show") ||
                    await waitForSelector(".profile-photo-edit__preview");
    if (photoEl) photo = photoEl.getAttribute("src") || "";
    if (!photo) photo = document.querySelector('meta[property="og:image"]')?.content || "";

    /* ---------- EXPERIENCE ---------- */
    const experienceEls = document.querySelectorAll("#experience ~ div ul > li");
    const experience = Array.from(experienceEls).map(el => ({
      title  : firstLine(el.querySelector("span[aria-hidden='true']")?.innerText),
      company: firstLine(el.querySelector(".t-14.t-normal")?.innerText),
      date   : cleanDate(el.querySelector(".t-14.t-normal.t-black--light")?.innerText)
    }));

    /* ---------- EDUCATION ---------- */
    const educationEls = document.querySelectorAll("#education ~ div ul > li");
    const education = Array.from(educationEls).map(el => ({
      school: firstLine(el.querySelector("span[aria-hidden='true']")?.innerText),
      degree: firstLine(el.querySelector(".t-14.t-normal")?.innerText),
      date  : cleanDate(el.querySelector(".t-14.t-normal.t-black--light")?.innerText)
    }));

    /* ---------- SKILLS ---------- */
    await clickIfExists('button[aria-label*="Afficher plus"][aria-label*="compétence"], button[aria-label*="Show all"][aria-label*="skill"]');
    const skillSpans = document.querySelectorAll(
      'a[href*="SKILL_NAVIGATION"] span[aria-hidden="true"],' +
      'span.pv-skill-category-entity__name-text,' +
      'span.pvs-entity__skill-name'
    );
    const skills = Array.from(skillSpans)
      .map(sp => firstLine(sp.innerText))
      .filter(Boolean)
      .filter((v,i,arr) => arr.indexOf(v) === i);

    /* ---------- FILTERS ---------- */
    const filteredExperience = experience.filter(e => e.title && e.date);
    const filteredEducation  = education .filter(e => e.school && e.date);

    /* ---------- DOWNLOAD ---------- */
    const data = { name, photo, experience: filteredExperience, education: filteredEducation, skills };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${name || 'linkedin_profile'}.json` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  })();
}

function saveProfileAsPDF() {
  const waitForSelector = async (selector, maxRetries = 15, interval = 250) => {
    for (let i = 0; i < maxRetries; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise(res => setTimeout(res, interval));
    }
    return null;
  };

  (async () => {
     const moreBtn = await waitForSelector(
      'button[aria-label*="Plus d’actions"], ' +
      'button[aria-label*="Plus d\'actions"], ' +
      'button[aria-label*="Plus"]:not([aria-label*="compétence"]), ' +
      'button[aria-label*="More actions"], ' +
      'button.artdeco-dropdown__trigger[aria-expanded]'
    );
    if (!moreBtn) {
      alert("Bouton 'Plus / More actions' introuvable.");
      return;
    }
    moreBtn.click();

    const pdfBtn = await waitForSelector(
      'div[role="button"][aria-label*="Enregistrer au format PDF"], ' +
      'div[role="button"][aria-label*="Save to PDF"]'
    );
    if (!pdfBtn) { alert("Option 'Enregistrer au format PDF' non trouvée."); return; }
    pdfBtn.click(); // LinkedIn triggers native download
  })();
}
