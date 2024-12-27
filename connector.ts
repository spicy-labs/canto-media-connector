import { Connector, Media } from "@chili-publish/studio-connectors";
type CantoItem = CantoFolder | CantoAlbum;

type CantoFolder = {
  id: string,
  idPath: string,
  name: string,
  scheme: "folder",
  size: number,
  children: CantoItem[]
}

type CantoAlbum = {
  id: string,
  idPath: string,
  name: string,
  size: number,
  scheme: "album"
}

type ContextOptions = {
  startindex: number,
  pageSize: number,
  filter: string,
  collection: any,
  query: string,
  tagFilter: string,
  albumFilter: string,
  folderView: boolean,
  approved: boolean,
}

export default class MyConnector implements Media.MediaConnector {

  private runtime: Connector.ConnectorRuntimeContext;

  constructor(runtime: Connector.ConnectorRuntimeContext) {
    this.runtime = runtime;
  }

  async query(
    options: Connector.QueryOptions,
    context: Connector.Dictionary
  ): Promise<Media.MediaPage> {

    // Hold context options
    const contextOptions = {
      startindex: Number(options.pageToken) || 0,
      pageSize: options.pageSize || 0,
      filter: options.filter[0] ?? '',
      collection: options.collection ?? null,
      query: context['query'] ?? '',
      tagFilter: context['tagFilter'] ?? '',
      albumFilter: context['albumFilter'] ?? '',
      folderView: context['folderView'] ?? false,
      approved: context['approved'] ?? false,
    } as ContextOptions;

    // query before download check
    if (checkQueryBeforeDownload(options)) {
      return this.handleQueryBeforeDownload(contextOptions);
    }

    // Filter query (left-hand panel)
    if (contextOptions.filter != '') {
      return this.handleFilterQuery(contextOptions);
    }

    // Folder browsing
    if (contextOptions.folderView) {
      return this.handleFolderBrowsing(contextOptions);
    }

    // Search query
    return this.handleSearchQuery(contextOptions);
  }
  detail(
    id: string,
    context: Connector.Dictionary
  ): Promise<Media.MediaDetail> {
    throw new Error("Method not implemented.");
  }
  async download(
    id: string,
    previewType: Media.DownloadType,
    intent: Media.DownloadIntent,
    context: Connector.Dictionary
  ): Promise<Connector.ArrayBufferPointer> {


    if (context["failNotApproved"]) {

      const url = `${this.runtime.options["baseURL"]}/api/v1/image/${id}`;

      const resp = await this.runtime.fetch(url, {
        method: "GET"
      });

      if (!resp.ok) {
        throw new Error("Failed to fetch info from Canto");
      }

      const data = JSON.parse(resp.text);

      if (data.approvalStatus != "Approved") {
        throw new Error("Image Not Approve");
      }

    }

    this.runtime.logError(id)

    switch (previewType) {
      case "thumbnail": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/preview/240`, { method: "GET" });
        return picture.arrayBuffer;
      }
      case "mediumres": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/preview/400`, { method: "GET" });
        return picture.arrayBuffer;
      }
      case "highres": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/preview/400`, { method: "GET" });
        return picture.arrayBuffer;
      }
      case "fullres": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/PNG`, { method: "GET" });
        return picture.arrayBuffer;
      }
      case "original": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}`, { method: "GET" });
        return picture.arrayBuffer;
      }
      default: {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/preview/240`, { method: "GET" });
        return picture.arrayBuffer;
      }
    }
  }
  getConfigurationOptions(): Connector.ConnectorConfigValue[] | null {
    return [
      {
        name: "folderView",
        displayName: "Folder View (keyword and tag will be ignored",
        type: "boolean"
      },
      {
        name: "query",
        displayName: "Keyword filter",
        type: "text"
      }, {
        name: "tagFilter",
        displayName: "Tag filter",
        type: "text"
      },
      {
        name: "albumFilter",
        displayName: "Album filter",
        type: "text"
      },
      {
        name: "approved",
        displayName: "Only show approved",
        type: "boolean"
      },
      {
        name: "failNotApproved",
        displayName: "Fail Loading and Output if not approved",
        type: "boolean"
      }];
  }
  getCapabilities(): Media.MediaConnectorCapabilities {
    return {
      query: true,
      detail: true,
      filtering: true,
      metadata: true,
    };
  }
  // custom functions
  buildSearchURL(keyword: string, tag: string, album: string, approved: boolean, pageSize: number, startIndex: number) {
    let url = `${this.runtime.options["baseURL"]}/api/v1/search?scheme=image&limit=${pageSize}&start=${startIndex * pageSize}`;
    // Check if there's an album provided first, that changes the base endpoint
    if (album != '') {
      url = `${this.runtime.options["baseURL"]}/api/v1/album/${album}?scheme=image&limit=${pageSize}&start=${startIndex * pageSize}`;
    }
    if (keyword != '') {
      url += `&keyword=${keyword}`;
    }
    if (tag != '') {
      url += `&tags=${tag}`;
    }
    if (approved) {
      url += `&approval=approved`;
    }

    return url;
  }

  async handleQueryBeforeDownload(contextOptions: ContextOptions): Promise<Media.MediaPage> {
    const id = contextOptions.filter;
    const url = `${this.runtime.options["baseURL"]}/api/v1/image/${id}`;
    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });

    if (!resp.ok) {
      throw new Error("Failed to fetch info from Canto");
    }

    const data = JSON.parse(resp.text);

    // For now, doesn't use buildMediaPage, as this is its own unique case
    return {
      pageSize: contextOptions.pageSize,
      data: [{
        id: contextOptions.filter,
        name: "",
        relativePath: "",
        type: 0,
        metaData: parseMetadata(data),
      }],
      links: {
        nextPage: ""
      }
    }
  }

  async handleFolderBrowsing(contextOptions: ContextOptions): Promise<Media.MediaPage> { 
    const { path, scheme } = (JSON.parse(contextOptions.collection.split("$$")[1] ?? `{ "path": "/", "scheme": "folder" }`)) as { path: string, scheme: "folder" | "album" };
    const pathSteps = path.split("/").filter(p => p);

    if (scheme == "folder") {
      return this.handleSearchFolder(contextOptions, pathSteps);
    }
    else {
      return this.handleSearchAlbum(contextOptions, pathSteps);
    }
  }

  async handleSearchFolder(contextOptions: ContextOptions, pathSteps: Array<any>): Promise<Media.MediaPage> {
    let url = `${this.runtime.options["baseURL"]}/api/v1/tree?sortBy=scheme&sortDirection=ascending&layer=-1`;
    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });

    if (resp.ok) {
      const allDirectories = (JSON.parse(resp.text)).results as CantoItem[];
      const currentDir = pathSteps.length == 0 ? allDirectories : pathSteps.reduce((p, c) => {
        return (p.find(item => item.id == c) as CantoFolder).children
      }, allDirectories);

      const dataFormatted = formatData(currentDir, contextOptions.pageSize, true);
      return buildMediaPage(contextOptions, dataFormatted);
    }
    throw new Error("Failed to fetch images from Canto!")
  }

  async handleSearchAlbum(contextOptions: ContextOptions, pathSteps: Array<any>): Promise<Media.MediaPage> {
    const id = pathSteps[pathSteps.length - 1];
    // The album search endpoint used here normally behaves very differently to the one used everywhere else. I've replaced it, but keeping the old one in comments for now
    let url = this.buildSearchURL('', '', id, false, contextOptions.pageSize, contextOptions.startindex);
    // let url = `${this.runtime.options["baseURL"]}/rest/search/album/${id}?aggsEnabled=true&sortBy=created&sortDirection=false&size=${options.pageSize}&type=image&start=${startIndex}`;

    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });

    if (resp.ok) {
      const imagesFound = JSON.parse(resp.text).results;
      const dataFormatted = formatData(imagesFound, contextOptions.pageSize);

      return buildMediaPage(contextOptions, dataFormatted);
    }

    throw new Error("Failed to fetch images from Canto!")
  }

  async handleSearchQuery(contextOptions: ContextOptions): Promise<Media.MediaPage> {
    const albums = (contextOptions.albumFilter as string).split("&");
    let dataFormatted = [];

    for (let i = 0; i < albums.length; i++) {
      let url = this.buildSearchURL(
        contextOptions.query as string,
        contextOptions.tagFilter as string,
        albums[i].trim(),
        contextOptions.approved as boolean,
        contextOptions.pageSize,
        contextOptions.startindex
      );
      const resp = await this.runtime.fetch(url, {
        method: "GET"
      });

      if (resp.ok) {
        const data = (JSON.parse(resp.text)).results;
        if (data) {
          dataFormatted = dataFormatted.concat(formatData(data, contextOptions.pageSize));
        }
      } else {
        throw new Error("Failed to fetch images from Canto!")
      }
    }
    return buildMediaPage(contextOptions, dataFormatted);

  }

  async handleFilterQuery(contextOptions: ContextOptions): Promise<Media.MediaPage> {
    let url = this.buildSearchURL(
      contextOptions.filter as string,
      contextOptions.tagFilter as string,
      contextOptions.albumFilter as string,
      contextOptions.approved as boolean,
      contextOptions.pageSize,
      contextOptions.startindex
    );
    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });

    if (resp.ok) {
      const data = (JSON.parse(resp.text)).results;
      const dataFormatted = formatData(data, contextOptions.pageSize);
      return buildMediaPage(contextOptions, dataFormatted);
    }
    throw new Error("Failed to fetch images from Canto!")
  }
}

function toDictionary(obj: Record<string, any>): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = "";
    } else if (typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.join(",");
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === "object") {
      result[key] = JSON.stringify(value);
    } else if (typeof value === "symbol" || typeof value === "bigint" || typeof value === "function") {
      result[key] = value.toString();
    } else {
      result[key] = String(value);
    }
  }

  return result;
}

function checkQueryBeforeDownload(options: Connector.QueryOptions): boolean {
  return options.pageSize === 1 && !options.collection;
}

function parseMetadata(data: any): Record<string, string | boolean> {
  return {
    owner: data.ownerName ?? '',
    resolution: data.dpi ?? '',
    approvalStatus: data.approvalStatus ?? '',
    width: data.width ?? '',
    height: data.height ?? '',
    ...toDictionary(data.default),
    ...toDictionary(data.additional)
  };
}

function formatData(results: any[], pageSize: number, isFolder?: boolean): Array<any> {
  // I don't really like this being a whole if/else block
  let dataFormatted;
  if (isFolder) {
    dataFormatted = results.filter(d => d.scheme == "folder" || d.scheme == "album").map(d => ({
      id: d.idPath,
      name: d.name,
      relativePath: "$$" + JSON.stringify({ path: d.idPath, scheme: d.scheme }) + "$$",
      type: 1,
      metaData: {}
    })) as Array<any>;
  }
  else {
    dataFormatted = results.map(d => ({
      id: d.id,
      name: d.name,
      relativePath: "/",
      type: 0,
      metaData: {}
    })) as Array<any>;
  }

  return dataFormatted;
}

function buildMediaPage(contextOptions: ContextOptions, data: any[]): Media.MediaPage {
  // I'm not sure if having a static pagination string in the nextPage link for everything will break things? I don't think this ever explicitly needs to be blank
  return {
    pageSize: contextOptions.pageSize,
    data: data,
    links: {
      nextPage: `${data.length < contextOptions.pageSize ? '' : contextOptions.startindex + 1}`
    }
  }
}