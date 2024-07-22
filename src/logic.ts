const kMillisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
const kOneWeekAgo = new Date().getTime() - kMillisecondsPerWeek;
const historyDiv = document.getElementById("historyDiv")!;
const marginStep = 30;

type Visit = {
  url: string;
  title: string;
  lastVisitTime: number;
  to: Visit[];
  root: string;
  hasFrom: boolean;
};

type URLTree = Array<Visit>;

function faviconURL(u: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "24");
  return url.toString();
}

function urlIndex(urlTree: URLTree, url: string) {
  for (let i = 0; i < urlTree.length; i++) {
    if (url === urlTree[i].url) {
      return i;
    }
  }
  return -1;
}

function changeRoot(visit: Visit, url: string) {
  visit.root = url;
  if (visit.to.length > 0) {
    for (let to of visit.to) {
      changeRoot(to, url);
    }
  }
}

async function buildTree(urlTree: URLTree) {
  let changed = false;
  for (let visit of urlTree) {
    // fetch destinations from local storage
    let tos: string[] = [];
    await chrome.storage.local.get(visit.url).then((result) => {
      if (result[visit.url] !== undefined) {
        tos = result[visit.url];
      }
    });

    // build tree
    if (tos.length > 0) {
      for (let to of tos) {
        let index = urlIndex(urlTree, to);
        if (
          index >= 0 &&
          visit.to.indexOf(urlTree[index]) < 0 &&
          urlTree[index].root != visit.root
        ) {
          let child = urlTree[index];
          changeRoot(child, visit.root);
          visit.to.push(child);
          urlTree[index].hasFrom = true;
          changed = true;
        }
      }
    }
  }
  return changed;
}

function newVisit(item: chrome.history.HistoryItem): Visit {
  return {
    url: item.url!,
    title: item.title!,
    lastVisitTime: item.lastVisitTime!,
    to: [],
    root: item.url!,
    hasFrom: false,
  };
}

async function makeUrlTree(historyItems: chrome.history.HistoryItem[]) {
  // fetch historyItems => urlTree
  let urlTree: URLTree = [];
  for (let item of historyItems) {
    let visit = newVisit(item);
    try {
      newVisit(item);
      urlTree.push(visit);
    } catch (e) {
      console.log("invalid historyItem: ", e);
    }
  }

  await buildTree(urlTree);

  let onlyRoot: URLTree = [];
  for (let visit of urlTree) {
    if (!visit.hasFrom) {
      onlyRoot.push(visit);
    }
  }
  return onlyRoot;
}

function createVisit(
  item: Visit,
  template: HTMLTemplateElement,
  depth: number
) {
  const clone = document.importNode(template.content, true);
  const pageLinkEl: HTMLAnchorElement = clone.querySelector(".page-link")!;
  const pageTitleEl: HTMLParagraphElement = clone.querySelector(".page-title")!;
  const imageWrapperEl: HTMLDivElement = clone.querySelector(".image-wrapper")!;
  const favicon = document.createElement("img");
  pageLinkEl.href = item.url;
  favicon.src = faviconURL(item.url);
  pageLinkEl.textContent = item.url;
  imageWrapperEl.prepend(favicon);
  if (!item.title) {
    pageTitleEl.style.display = "none";
  }
  pageTitleEl.innerText = item.title;

  let history: HTMLDivElement = clone.querySelector(".history")!;
  history.style.marginLeft = marginStep * depth + "px";
  historyDiv.appendChild(clone);
}

function createJourney(
  journey: Visit,
  template: HTMLTemplateElement,
  depth: number
) {
  createVisit(journey, template, depth);
  if (journey.to.length == 0) return;
  for (let to of journey.to) {
    createJourney(to, template, depth + 1);
  }
}

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

document.getElementById("deleteSelected")!.onclick = async function () {
  const checkboxes = document.getElementsByTagName("input");
  for (let checkbox of checkboxes) {
    if (checkbox.checked) {
      await chrome.history.deleteUrl({ url: checkbox.value });
    }
  }
  location.reload();
};

document.getElementById("removeAll")!.onclick = async function () {
  await chrome.history.deleteAll();
  location.reload();
};

chrome.history
  .search({
    text: "",
    startTime: kOneWeekAgo,
    maxResults: 99,
  })
  .then(constructHistory);
