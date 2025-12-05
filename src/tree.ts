
export type Visit = {
  id: string;
  url: string;
  title: string;
  lastVisitTime: number;
  to: Visit[];
  root: string;
  fromVisitId?: string;
};

// faviconURL creates a URL for favicon of a page
function faviconURL(u: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "32"); // Increased size for better quality
  return url.toString();
}

// makeUrlTree makes a tree of URLs from historyItems using referringVisitId
// This uses the native Chrome History API to reconstruct the browsing flow.
async function makeUrlTree(historyItems: chrome.history.HistoryItem[]): Promise<Visit[]> {
  const visitMap = new Map<string, Visit>();
  const visitsToProcess: { visitId: string; historyItem: chrome.history.HistoryItem }[] = [];

  // 1. Gather all visits for the history items
  for (const item of historyItems) {
    if (!item.url) continue;
    try {
      const visits = await chrome.history.getVisits({ url: item.url });
      // We process all visits to find connections, but we primarily care about the most recent ones
      // in the context of the requested history window.
      // For simplicity in this visualization, we might map the *latest* visit of a URL to the tree,
      // or try to show all. Let's start by mapping the latest visit for each history item.
      if (visits.length > 0) {
        const latestVisit = visits[visits.length - 1]; // Use the most recent visit
        visitsToProcess.push({ visitId: latestVisit.visitId, historyItem: item });
        
        const visitNode: Visit = {
          id: latestVisit.visitId,
          url: item.url,
          title: item.title || item.url,
          lastVisitTime: item.lastVisitTime || 0,
          to: [],
          root: item.url, // Temporarily self as root
          fromVisitId: latestVisit.referringVisitId,
        };
        visitMap.set(latestVisit.visitId, visitNode);
      }
    } catch (e) {
      console.warn("Error processing item:", item.url, e);
    }
  }

  // 2. Build the tree structure
  const rootVisits: Visit[] = [];

  // We need to be careful: referringVisitId might point to a visit NOT in our current set 
  // (e.g. from more than 1 week ago, or filtered out).
  // However, `chrome.history.search` filtered by 1 week.
  // We might miss parents if we only look at `historyItems`.
  // Ideally, we would fetch parents recursively, but for a strict scope,
  // we will only link if the parent exists in our current map.

  for (const visit of visitMap.values()) {
    if (visit.fromVisitId && visit.fromVisitId !== "0" && visitMap.has(visit.fromVisitId)) {
       const parent = visitMap.get(visit.fromVisitId)!;
       parent.to.push(visit);
       // The child is not a root
    } else {
       // It's a root (or we can't find the parent in this window)
       rootVisits.push(visit);
    }
  }
  
  // Sort roots by time
  rootVisits.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

  return rootVisits;
}

// createVisit creates an actual history element and add it to DOM
async function createVisit(
  item: Visit,
  template: HTMLTemplateElement,
  depth: number,
  parentNode: HTMLElement,
  marginStep: number = 20
) {
  const clone = document.importNode(template.content, true);
  const historyEl = clone.querySelector(".history") as HTMLDivElement;
  const pageLinkEl = clone.querySelector(".page-link") as HTMLAnchorElement;
  const pageTitleEl = clone.querySelector(".page-title") as HTMLParagraphElement;
  const imageWrapperEl = clone.querySelector(".image-wrapper") as HTMLDivElement;
  const toggleCheck = clone.querySelector(".toggle-check") as HTMLInputElement;
  const timeEl = clone.querySelector(".page-visit-time") as HTMLElement; // Might add this to HTML

  // Setup content
  pageLinkEl.href = item.url;
  pageLinkEl.textContent = new URL(item.url).hostname; // Show domain as link text for cleanliness
  pageTitleEl.textContent = item.title;
  
  if (item.title === "") {
      pageTitleEl.textContent = item.url;
  }

  // Favicon
  const favicon = document.createElement("img");
  favicon.src = faviconURL(item.url);
  favicon.loading = "lazy";
  imageWrapperEl.innerHTML = ''; // Clear existing
  imageWrapperEl.appendChild(favicon);

  // Indentation
  // Instead of margin-left on the card, we might want to nest them in container.
  // But complying with current structure:
  // historyEl.style.marginLeft = `${depth * marginStep}px`;
  // Actually, standard tree structures usually nest <div>s.
  // The current logic.ts appends to the parent div.
  // Let's stick to the current flat-ish structure but use padding or nested divs if possible.
  // The previous implementation used margin-left on the card.
  
  // Interaction
  if (item.to.length === 0) {
     const toggleWrapper = clone.querySelector(".toggle-wrapper") as HTMLElement;
     toggleWrapper.style.visibility = "hidden"; // Hide arrow if no children
  }

  // Open link behavior
  pageLinkEl.addEventListener("click", (e) => {
      e.stopPropagation(); // Don't trigger fold
  });
  
  historyEl.addEventListener("click", (e) => {
    // If clicking the card body (not link), maybe toggle fold?
    // Or just let the arrow do it.
    // Let's make the whole card clickable to toggle fold if it has children.
    if (item.to.length > 0) {
       // toggleCheck.checked = !toggleCheck.checked;
       // Trigger change event to handle folding logic if needed
    }
  });

  // Delete behavior
  const deleteBtn = clone.querySelector(".delete-btn");
  if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (confirm(`Remove this item from history?`)) {
              await chrome.history.deleteUrl({ url: item.url });
              // Remove visual element
              // If it's a wrapper structure (logic.ts), we might need to remove the whole wrapper.
              // Since createVisit returns the .history element, and logic.ts wraps it,
              // we can find the closest .journey-wrapper to remove.
              const wrapper = historyEl.closest(".journey-wrapper");
              if (wrapper) {
                  wrapper.remove();
              } else {
                  historyEl.remove();
              }
          }
      });
  }

  // Folding logic
  toggleCheck.addEventListener("change", (e) => {
      const container = parentNode.querySelector(`.children-container[data-id="${item.id}"]`);
      if (container) {
          if (toggleCheck.checked) {
              container.classList.add("folded");
          } else {
              container.classList.remove("folded");
          }
      }
  });

  parentNode.appendChild(clone);
  
  // Return the children container for next level
  // We need to modify the HTML structure to support nesting if we want true trees
  // But `logic.ts` call `createJourney` recursively. 
  // Let's adapt `logic.ts` to handle nesting properly.
  // For `createVisit`, we just return the element.
  
  return historyEl;
}

export { makeUrlTree, createVisit };