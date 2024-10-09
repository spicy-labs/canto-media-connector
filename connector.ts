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
      return {
        pageSize: options.pageSize,
        data: [{
          id: options.filter[0],
          name: "",
          relativePath: "",
          type: 0,
          metaData: {}
        }],
        links: {
          nextPage: ""
        }
      }
    }

    // normal query
    const startIndex = Number(options.pageToken) || 0;
    const query = context['query'] ?? '';
    const tagQuery = context['tag'] ?? '';
    const filter = options.filter[0] ?? '';
    const finalQuery = filter + query;

    let url = `${this.runtime.options["baseURL"]}/api/v1/search?scheme=image&limit=${options.pageSize}&start=${startIndex * options.pageSize}${(finalQuery != '') ? `&keyword=${finalQuery}` : ''}${(tagQuery != '') ? `&tags=${tagQuery}` : ''}`;

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
      displayName: "Search Query",
      type: "text"
    }, {
      name: "tag",
      displayName: "Tag(s)",
      type: "text"
    }];
  }
  getCapabilities(): Media.MediaConnectorCapabilities {
    return {
      query: true,
      detail: true,
      filtering: true,
      metadata: false,
    };
  }
}