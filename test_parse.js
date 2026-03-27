const flat = [];
const ROOT_SKIP = new Set(['Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Other Bookmarks', 'Mobile bookmarks', 'Mobile Bookmarks', '']);

function walk(nodes, pathSegments = []) {
  for (const node of nodes) {
    if (node.url) {
      const folderPath = pathSegments.filter(Boolean).join(' / ') || 'Imported';
      flat.push({ url: node.url, title: node.title || node.url, folder: folderPath });
    }
    if (node.children) {
      const shouldAddToPath = node.title && !ROOT_SKIP.has(node.title);
      walk(node.children, shouldAddToPath ? [...pathSegments, node.title] : pathSegments);
    }
  }
}

// simulate user's problem
const mockTree = [{
  id: "0",
  children: [{
    id: "1",
    title: "Bookmarks bar",
    children: [{
      id: "2",
      title: "AWS", // maybe the user has a folder called AWS directly inside Bookmarks bar
      children: [
        {id: "3", url: "http://aws.com", title: "aws"}
      ]
    }, {
      id: "4",
      title: "TopFolder", // Top folder they said it doesn't bring
      children: [
        {
          id: "5",
          title: "SubFolder",
          children: [
            {id: "6", url: "http://sub.com", title: "sub"}
          ]
        }
      ]
    }]
  }]
}];

if (mockTree[0]?.children) {
  for (const topLevel of mockTree[0].children) {
    if (topLevel.children) {
      walk(topLevel.children, ROOT_SKIP.has(topLevel.title) ? [] : [topLevel.title]);
    } else if (topLevel.url) {
      flat.push({ url: topLevel.url, title: topLevel.title || topLevel.url, folder: 'Imported' });
    }
  }
}
console.log(flat);
