import { makeUrlTree, createVisit, Visit } from "./tree";

const kMillisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
const kOneWeekAgo = new Date().getTime() - kMillisecondsPerWeek;
const historyDiv = document.getElementById("historyDiv")!;

// createJourney recursively creates journey elements
function createJourney(
  journey: Visit,
  template: HTMLTemplateElement,
  depth: number
) {
  // Create root element for this journey
  createVisit(journey, template, depth);
  if (journey.to.length == 0) return;
  // Create children elements
  for (let to of journey.to) {
    createJourney(to, template, depth + 1);
  }
}

// constructHistory makes a history tree and create elements of Journeys
async function constructHistory(historyItems: chrome.history.HistoryItem[]) {
  let urlTree = await makeUrlTree(historyItems);
  const template: HTMLTemplateElement = <HTMLTemplateElement>(
    document.getElementById("historyTemplate")!
  );
  if (template === null) return;

  for (let journey of urlTree) {
    createJourney(journey, template, 0);
  }
}

// SearchSubmit event listener
document.getElementById("searchSubmit")!.onclick = async function () {
  historyDiv.innerHTML = " ";
  const searchQuery = (<HTMLInputElement>(
    document.getElementById("searchInput")!
  )).value;
  const historyItems = await chrome.history.search({
    text: searchQuery,
    startTime: kOneWeekAgo,
  });
  await constructHistory(historyItems);
};

// DeleteSelected event listener
document.getElementById("deleteSelected")!.onclick = async function () {
  const checkboxes = document.getElementsByTagName("input");
  for (let checkbox of checkboxes) {
    if (checkbox.checked) {
      await chrome.history.deleteUrl({ url: checkbox.value });
    }
  }
  location.reload();
};

// removeAll event listener
document.getElementById("removeAll")!.onclick = async function () {
  await chrome.history.deleteAll();
  location.reload();
};

// Create history page
chrome.history
  .search({
    text: "",
    startTime: kOneWeekAgo,
    maxResults: 199,
  })
  .then(constructHistory);
