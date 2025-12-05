import { makeUrlTree, createVisit, Visit } from "./tree";

const kMillisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
const kOneWeekAgo = new Date().getTime() - kMillisecondsPerWeek;
const historyDiv = document.getElementById("historyDiv")!;

// createJourney recursively creates journey elements
async function createJourney(
  journey: Visit,
  template: HTMLTemplateElement,
  depth: number,
  parentNode: HTMLElement
) {
  // Create a wrapper for this node and its children
  let wrapper = document.createElement("div");
  wrapper.classList.add("journey-wrapper");
  
  // Create the visit card
  await createVisit(journey, template, depth, wrapper);

  // If there are children, create a container for them
  if (journey.to.length > 0) {
    let childrenContainer = document.createElement("div");
    childrenContainer.classList.add("children-container");
    childrenContainer.setAttribute("data-id", journey.id); // Connect for folding
    wrapper.appendChild(childrenContainer);

    for (let to of journey.to) {
      createJourney(to, template, depth + 1, childrenContainer);
    }
  }
  
  parentNode.appendChild(wrapper);
}

// Helper to determine group
function getDateGroup(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const last7Days = today - 6 * 24 * 60 * 60 * 1000;

    if (timestamp >= today) return "Today";
    if (timestamp >= yesterday) return "Yesterday";
    if (timestamp >= last7Days) return "Last 7 Days";
    return "Older";
}

// Render a section header
function createSectionHeader(title: string, parentNode: HTMLElement) {
    const header = document.createElement("h2");
    header.textContent = title;
    header.className = "date-header";
    parentNode.appendChild(header);
}

// constructHistory makes a history tree and create elements of Journeys
async function constructHistory(historyItems: chrome.history.HistoryItem[]) {
  // Clear loading state if any
  historyDiv.innerHTML = "";
  
  let urlTree = await makeUrlTree(historyItems);
  const template: HTMLTemplateElement = <HTMLTemplateElement>(
    document.getElementById("historyTemplate")!
  );
  if (template === null) return;

  if (urlTree.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.innerText = "No history found in the last week.";
      emptyMsg.className = "empty-state";
      historyDiv.appendChild(emptyMsg);
      return;
  }

  const groups: Record<string, Visit[]> = {
      "Today": [],
      "Yesterday": [],
      "Last 7 Days": [],
      "Older": []
  };

  for (let journey of urlTree) {
      const groupName = getDateGroup(journey.lastVisitTime);
      groups[groupName].push(journey);
  }

  for (const groupName of ["Today", "Yesterday", "Last 7 Days", "Older"]) {
      if (groups[groupName].length > 0) {
          createSectionHeader(groupName, historyDiv);
          for (let journey of groups[groupName]) {
              await createJourney(journey, template, 0, historyDiv);
          }
      }
  }
}

// Search functionality
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const searchSubmit = document.getElementById("searchSubmit") as HTMLInputElement;

async function performSearch() {
    const query = searchInput.value;
    const items = await chrome.history.search({
        text: query,
        startTime: kOneWeekAgo,
        maxResults: 500,
    });
    constructHistory(items);
}

searchSubmit.addEventListener("click", performSearch);
searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") performSearch();
});


// Initial Load
chrome.history
  .search({
    text: "",
    startTime: kOneWeekAgo,
    maxResults: 500, // Increased limit
  })
  .then(constructHistory);
