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
  // Create root element for this journey
  let div = document.createElement("div");
  div.classList.add("journey");
  await createVisit(journey, template, depth, div);
  if (journey.to.length == 0) {
    parentNode.appendChild(div);
    return;
  }
  // Create children elements
  for (let to of journey.to) {
    createJourney(to, template, depth + 1, div);
  }
  parentNode.appendChild(div);
}

// constructHistory makes a history tree and create elements of Journeys
async function constructHistory(historyItems: chrome.history.HistoryItem[]) {
  let urlTree = await makeUrlTree(historyItems);
  const template: HTMLTemplateElement = <HTMLTemplateElement>(
    document.getElementById("historyTemplate")!
  );
  if (template === null) return;

  for (let journey of urlTree) {
    createJourney(journey, template, 0, historyDiv);
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

// RemoveAll event listener
document.getElementById("removeAll")!.onclick = async function () {
  await chrome.history.deleteAll();
  location.reload();
};

let onlyJourney = document.getElementById("onlyJourney")!
onlyJourney.onclick = async () => {
  let hide = onlyJourney.classList.toggle("onlyJourney")
  document.querySelectorAll(".notJourney").forEach((element) => {
    if (hide)
      (<HTMLElement>element).style.display = "none";
    else (<HTMLElement>element).style.display = "flex";
  })
}

// Create history page
chrome.history
  .search({
    text: "",
    startTime: kOneWeekAgo,
    maxResults: 199,
  })
  .then(constructHistory);
