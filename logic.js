const kMillisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
const kOneWeekAgo = new Date().getTime() - kMillisecondsPerWeek;
const historyDiv = document.getElementById('historyDiv');
const marginStep = 30;

function faviconURL(u) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', u);
  url.searchParams.set('size', '24');
  return url.toString();
}

function urlIndex(urlTree, url) {
  for (let i=0; i<urlTree.length; i++) {
    // console.log("url compare: ", visit.url, " ", urlTree[i].url)
    if (url === urlTree[i].url) {
      return i
    }
  }
  return -1
}

function changeRoot(visit, url) {
  visit.root = url
  if (visit.to.length > 0) {
    for (let to of visit.to) {
      changeRoot(to, url)
    }
  }
}

async function buildTree(urlTree) {
  changed = false
  for (let visit of urlTree) {
    // fetch destinations from local storage
    tos = []
    await chrome.storage.local.get(visit.url).then((result) => {
      if (result[visit.url] !== undefined) {
        tos = result[visit.url]
      }
    })

    // build tree
    if (tos.length > 0) {
      for (let to of tos) {
        index = urlIndex(urlTree, to)
        if (index >= 0 && visit.to.indexOf(urlTree[index]) < 0) {
          child = urlTree[index]
          changeRoot(child, visit.root)
          visit.to.push(child)
          urlTree[index].hasFrom = true
          changed = true
        }
      }
    }
  }
  return changed
}

async function makeUrlTree(historyItems) {
  // fetch historyItems => urlTree
  urlTree = []
  for (let item of historyItems) {
    visit = {
      url: item.url,
      title: item.title,
      lastVisitTime: item.lastVisitTime,
      to: [],
      root: item.url,
      hasFrom: false
    }
    urlTree.push(visit)
  }

  await buildTree(urlTree)

  onlyRoot = []
  for (visit of urlTree) {
    if (!visit.hasFrom) {
      onlyRoot.push(visit)
    }
  }
  return onlyRoot
}

function createVisit(item, template, depth) {
  const clone = document.importNode(template.content, true);
  const pageLinkEl = clone.querySelector('.page-link');
  const pageTitleEl = clone.querySelector('.page-title');
  // const pageVisitTimeEl = clone.querySelector('.page-visit-time');
  const imageWrapperEl = clone.querySelector('.image-wrapper');
  // const checkbox = clone.querySelector('.removeCheck, input');
  // checkbox.setAttribute('value', item.url);
  const favicon = document.createElement('img');
  pageLinkEl.href = item.url;
  favicon.src = faviconURL(item.url);
  pageLinkEl.textContent = item.url;
  imageWrapperEl.prepend(favicon);
  // pageVisitTimeEl.textContent = new Date(item.lastVisitTime).toLocaleString();
  if (!item.title) {
    pageTitleEl.style.display = 'none';
  }
  pageTitleEl.innerText = item.title;

  // clone
  //   .querySelector('.removeButton, button')
  //   .addEventListener('click', async function () {
  //     await chrome.history.deleteUrl({ url: item.url });
  //     location.reload();
  //   });

  // clone
  //   .querySelector('.history')
  //   .addEventListener('click', async function (event) {
  //     // fix double click
  //     if (event.target.className === 'removeCheck') {
  //       return;
  //     }
  //
  //     checkbox.checked = !checkbox.checked;
  //   });
  clone.querySelector('.history').style.marginLeft = marginStep * depth + 'px';
  historyDiv.appendChild(clone);
}

function createJourney(journey, template, depth) {
  createVisit(journey, template, depth)
  if (journey.to === []) return
  for (let to of journey.to) {
    createJourney(to, template, depth + 1)
  }
}

async function constructHistory(historyItems) {
  urlTree = await makeUrlTree(historyItems)
  console.log(urlTree)
  const template = document.getElementById('historyTemplate');
  for (let journey of urlTree) {
    createJourney(journey, template, 0)
  }
}

document.getElementById('searchSubmit').onclick = async function () {
  historyDiv.innerHTML = ' ';
  const searchQuery = document.getElementById('searchInput').value;
  const historyItems = await chrome.history.search({
    text: searchQuery,
    startTime: kOneWeekAgo
  });
  await constructHistory(historyItems);
};

document.getElementById('deleteSelected').onclick = async function () {
  const checkboxes = document.getElementsByTagName('input');
  for (let checkbox of checkboxes) {
    if (checkbox.checked == true) {
      await chrome.history.deleteUrl({ url: checkbox.value });
    }
  }
  location.reload();
};

document.getElementById('removeAll').onclick = async function () {
  await chrome.history.deleteAll();
  location.reload();
};

chrome.history
  .search({
    text: '',
    startTime: kOneWeekAgo,
    maxResults: 99
  })
  .then(constructHistory);


