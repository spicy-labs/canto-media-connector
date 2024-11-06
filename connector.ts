import { Connector, Media } from "@chili-publish/studio-connectors";
export default class MyConnector implements Media.MediaConnector {

  private runtime: Connector.ConnectorRuntimeContext;

  constructor(runtime: Connector.ConnectorRuntimeContext) {
    this.runtime = runtime;
  }

  async query(
    options: Connector.QueryOptions,
    context: Connector.Dictionary
  ): Promise<Media.MediaPage> {

    // query before download check
    if (options.pageSize == 1 && !options.collection) {
      const id = options.filter[0];
      const url = `${this.runtime.options["baseURL"]}/api/v1/image/${id}`;

      const resp = await this.runtime.fetch(url, {
        method: "GET"
      });

      if(!resp.ok){
        throw new Error("Failed to fetch info from Canto");
      }

      const data = JSON.parse(resp.text);
      
      return {
        pageSize: options.pageSize,
        data: [{
          id: options.filter[0],
          name: "",
          relativePath: "",
          type: 0,
          metaData: {
            "owner": data.ownerName ?? '',
            "resolution": data.dpi ?? '',
            "approvalStatus": data.approvalStatus ?? '',
            "width": data.width ?? '',
            "height": data.height ?? '',
            "author": data.default.Author ?? '',
            "copyright": data.default.Copyright ?? ''
          }
        }],
        links: {
          nextPage: ""
        }
      }
    }

    // normal query
    const startIndex = Number(options.pageToken) || 0;
    const query = context['query'] ?? '';
    const tag = context['tagFilter'] ?? '';
    const filter = options.filter[0] ?? '';
    // const finalQuery = filter + query;
    const browseFolders = context['folderView'] ?? false;
    const approved = context['approved'] ?? false;
    const collection = options.collection ?? null;

    // Do an intial check to see if there's a filter, browse based on that
    if(filter != '') {
      let url = `${this.runtime.options["baseURL"]}/api/v1/search${this.buildQueryParams(filter as string, tag as string, approved as boolean, options.pageSize, startIndex)}`;
      const resp = await this.runtime.fetch(url, {
        method: "GET"
      });

      if (resp.ok) {
        const data = (JSON.parse(resp.text)).results;

        const dataFormatted = data.map(d => ({
          id: d.id,
          name: d.name,
          relativePath: "/",
          type: 0,
          metaData: {}
        })) as Array<any>;

        return {
          pageSize: options.pageSize,
          data: dataFormatted,
          links: {
            nextPage: `${dataFormatted.length < options.pageSize ? '' : startIndex + 1}`
          }
        }
      }

    }
    if (browseFolders) { //real quick test, invert to see if main browser cooperates

      let scheme = null;
      let id = null;
      if (collection != "/") {
        const collectionStrings = this.splitCollectionString(collection);
        scheme = collectionStrings[0];
        id = collectionStrings[1];
      }

      if (!scheme) {
        let url = `${this.runtime.options["baseURL"]}/api/v1/tree?sortBy=time&sortDirection=ascending&layer=1`;

        const resp = await this.runtime.fetch(url, {
          method: "GET"
        });

        if (resp.ok) {
          const data = (JSON.parse(resp.text)).results;

          const dataFormatted = data.map(d => ({
            id: d.idPath,
            name: d.namePath,
            relativePath: `${d.scheme}SPLIT_ME!${d.idPath}SPLIT_ME!`,
            type: 1,
            metaData: {}
          })) as Array<any>;

          return {
            pageSize: options.pageSize,
            data: dataFormatted,
            links: {
              nextPage: ''
            }
          }
        }
      } else if (scheme == "/folder") {
        let url = `${this.runtime.options["baseURL"]}/api/v1/tree/${id}?sortBy=time&sortDirection=ascending&layer=1`;

        const resp = await this.runtime.fetch(url, {
          method: "GET"
        });

        if (resp.ok) {
          const data = (JSON.parse(resp.text)).results;

          const dataFormatted = data.map(d => ({
            id: d.idPath,
            name: d.namePath,
            relativePath: `${d.scheme}SPLIT_ME!${d.idPath}SPLIT_ME!`,
            type: 1,
            metaData: {}
          })) as Array<any>;

          return {
            pageSize: options.pageSize,
            data: dataFormatted,
            links: {
              nextPage: ''
            }
          }
        }
      } else if (scheme == "/album") {
        let url = `${this.runtime.options["baseURL"]}/api/v1/album/${id}?scheme=image&limit=${options.pageSize}&start=${startIndex * options.pageSize}&sortBy=time&sortDirection=ascending`;

        const resp = await this.runtime.fetch(url, {
          method: "GET"
        });

        if (resp.ok) {
          const data = (JSON.parse(resp.text)).results;

          const dataFormatted = data.map(d => ({
            id: d.id,
            name: d.name,
            relativePath: "/",
            type: 0,
            metaData: {}
          })) as Array<any>;

          return {
            pageSize: options.pageSize,
            data: dataFormatted,
            links: {
              nextPage: `${dataFormatted.length < options.pageSize ? '' : startIndex + 1}`
            }
          }
        }
      }
    } else { //Filter search mode

      
      let url = `${this.runtime.options["baseURL"]}/api/v1/search${this.buildQueryParams(query as string, tag as string, approved as boolean, options.pageSize, startIndex)}`;
      const resp = await this.runtime.fetch(url, {
        method: "GET"
      });

      if (resp.ok) {
        const data = (JSON.parse(resp.text)).results;

        const dataFormatted = data.map(d => ({
          id: d.id,
          name: d.name,
          relativePath: "/",
          type: 0,
          metaData: {}
        })) as Array<any>;

        return {
          pageSize: options.pageSize,
          data: dataFormatted,
          links: {
            nextPage: `${dataFormatted.length < options.pageSize ? '' : startIndex + 1}`
          }
        }
      }

      // error handling
      throw new Error("Failed to fetch images from Canto!");
    }

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
    switch (previewType) {
      case "thumbnail": {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/preview`, { method: "GET" });
        return picture.arrayBuffer;
      }
      default: {
        const picture = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/api_binary/v1/image/${id}/PNG`, { method: "GET" });
        return picture.arrayBuffer;
      }
    }
  }
  getConfigurationOptions(): Connector.ConnectorConfigValue[] | null {
    return [{
      name: "query",
      displayName: "Keyword filter",
      type: "text"
    }, {
      name: "tagFilter",
      displayName: "Tag filter",
      type: "text"
    },
    {
      name: "approved",
      displayName: "Only show approved",
      type: "boolean"
    }, {
      name: "folderView",
      displayName: "Folder View",
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
  splitCollectionString(collection: string) {
    const collectionStrings = collection.split("SPLIT_ME!");
    return collectionStrings;
  }

  // setup query params
  buildQueryParams(keyword: string, tag: string, approved: boolean, pageSize: number, startIndex: number){
    let params = `?scheme=image&limit=${pageSize}&start=${startIndex * pageSize}`;
    if(keyword != '') {
      params += `&keyword=${keyword}`;
    }
    if(tag != '') {
      params += `&tags=${tag}`;
    }
    if(approved){
      params += `&approval=approved`;
    }

    return params;
  }
}