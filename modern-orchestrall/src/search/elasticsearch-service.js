const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      }
    });
    this.indexPrefix = process.env.ELASTICSEARCH_INDEX_PREFIX || 'orchestrall';
  }

  async createIndex(indexName, mapping) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const exists = await this.client.indices.exists({
        index: fullIndexName
      });

      if (!exists) {
        await this.client.indices.create({
          index: fullIndexName,
          body: {
            mappings: mapping,
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1,
              analysis: {
                analyzer: {
                  custom_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'stop', 'snowball']
                  }
                }
              }
            }
          }
        });
      }

      return {
        success: true,
        indexName: fullIndexName
      };
    } catch (error) {
      console.error('Index creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async indexDocument(indexName, document, id = null) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const params = {
        index: fullIndexName,
        body: document
      };

      if (id) {
        params.id = id;
      }

      const response = await this.client.index(params);
      
      return {
        success: true,
        id: response._id,
        index: response._index,
        result: response.result
      };
    } catch (error) {
      console.error('Document indexing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async bulkIndex(indexName, documents) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const body = documents.flatMap(doc => [
        { index: { _index: fullIndexName, _id: doc.id } },
        doc
      ]);

      const response = await this.client.bulk({ body });
      
      const results = {
        total: documents.length,
        successful: response.items.filter(item => !item.index.error).length,
        failed: response.items.filter(item => item.index.error).length,
        errors: response.items
          .filter(item => item.index.error)
          .map(item => ({
            id: item.index._id,
            error: item.index.error
          }))
      };

      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('Bulk indexing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async search(indexName, query, options = {}) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const searchParams = {
        index: fullIndexName,
        body: {
          query,
          ...options
        }
      };

      if (options.size) {
        searchParams.size = options.size;
      }

      if (options.from) {
        searchParams.from = options.from;
      }

      const response = await this.client.search(searchParams);
      
      return {
        success: true,
        hits: response.hits.hits.map(hit => ({
          id: hit._id,
          score: hit._score,
          source: hit._source
        })),
        total: response.hits.total.value,
        maxScore: response.hits.max_score,
        took: response.took
      };
    } catch (error) {
      console.error('Search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteDocument(indexName, id) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const response = await this.client.delete({
        index: fullIndexName,
        id
      });

      return {
        success: true,
        result: response.result
      };
    } catch (error) {
      console.error('Document deletion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateDocument(indexName, id, doc) {
    try {
      const fullIndexName = `${this.indexPrefix}_${indexName}`;
      
      const response = await this.client.update({
        index: fullIndexName,
        id,
        body: {
          doc
        }
      });

      return {
        success: true,
        result: response.result
      };
    } catch (error) {
      console.error('Document update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHealth() {
    try {
      const health = await this.client.cluster.health();
      return {
        success: true,
        status: health.status,
        numberOfNodes: health.number_of_nodes,
        activeShards: health.active_shards,
        relocatingShards: health.relocating_shards,
        initializingShards: health.initializing_shards,
        unassignedShards: health.unassigned_shards
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getIndices() {
    try {
      const indices = await this.client.cat.indices({
        format: 'json'
      });

      return {
        success: true,
        indices: indices.map(index => ({
          name: index.index,
          health: index.health,
          status: index.status,
          docsCount: index['docs.count'],
          docsDeleted: index['docs.deleted'],
          storeSize: index['store.size']
        }))
      };
    } catch (error) {
      console.error('Indices fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ElasticsearchService;
