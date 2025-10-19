// plugins/crm/zoho/index.js - Zoho CRM Integration Plugin
const axios = require('axios');

class ZohoCRMIntegration {
  constructor({ prisma, config, clientId, logger }) {
    this.prisma = prisma;
    this.config = config;
    this.clientId = clientId;
    this.logger = logger;
    this.clientId_zoho = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.environment = config.environment || 'sandbox';
    this.dataCenter = config.dataCenter || 'com';
    this.syncInterval = config.syncInterval || 300000; // 5 minutes
    
    // Set base URL based on environment and data center
    const subdomain = this.environment === 'production' ? 'www' : 'sandbox';
    this.baseUrl = `https://${subdomain}.zoho${this.dataCenter}/crm/v2`;
    
    this.accessToken = null;
    this.tokenExpiry = null;
    this.syncTimer = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info(`Initializing Zoho CRM integration for client: ${this.clientId}`);
      
      // Validate configuration
      if (!this.clientId_zoho || !this.clientSecret || !this.refreshToken) {
        throw new Error('Missing required Zoho CRM configuration');
      }

      // Get access token
      await this.refreshAccessToken();
      
      // Test API connection
      await this.testConnection();
      
      // Start periodic sync
      this.startPeriodicSync();
      
      this.initialized = true;
      this.logger.info('Zoho CRM integration initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Zoho CRM integration', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', {
        refresh_token: this.refreshToken,
        client_id: this.clientId_zoho,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token'
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      this.logger.info('Zoho CRM access token refreshed successfully');
      
    } catch (error) {
      this.logger.error('Failed to refresh Zoho CRM access token', error);
      throw error;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    // Check if token needs refresh
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data
      });

      return response;
    } catch (error) {
      this.logger.error(`Zoho CRM API request failed: ${method} ${endpoint}`, {
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.makeRequest('GET', '/Leads?per_page=1');
      this.logger.info('Zoho CRM API connection test successful');
      return response.data;
    } catch (error) {
      this.logger.error('Zoho CRM connection test failed', error);
      throw error;
    }
  }

  // Customer sync methods
  async syncCustomersToZoho() {
    try {
      this.logger.info('Starting customer sync to Zoho CRM');
      
      const customers = await this.prisma.customer.findMany({
        where: {
          organizationId: this.clientId
        },
        include: {
          orders: true
        }
      });

      for (const customer of customers) {
        await this.syncCustomerToZoho(customer);
      }

      this.logger.info(`Synced ${customers.length} customers to Zoho CRM`);
      return customers.length;
      
    } catch (error) {
      this.logger.error('Customer sync to Zoho CRM failed', error);
      throw error;
    }
  }

  async syncCustomerToZoho(customer) {
    try {
      // Check if customer already exists in Zoho
      const existingContact = await this.findContactByEmail(customer.email);
      
      const contactData = {
        First_Name: customer.name.split(' ')[0] || '',
        Last_Name: customer.name.split(' ').slice(1).join(' ') || '',
        Email: customer.email,
        Phone: customer.phone || '',
        Description: `Customer from ${this.clientId} organization`,
        Lead_Source: 'Website',
        Custom_Fields: {
          Organization_ID: this.clientId,
          Customer_ID: customer.id,
          Total_Orders: customer.orders.length,
          Total_Spent: customer.orders.reduce((sum, order) => sum + parseFloat(order.total), 0)
        }
      };

      if (existingContact) {
        // Update existing contact
        const response = await this.makeRequest('PUT', `/Contacts/${existingContact.id}`, {
          data: [contactData]
        });
        this.logger.debug(`Updated contact in Zoho: ${customer.email}`);
      } else {
        // Create new contact
        const response = await this.makeRequest('POST', '/Contacts', {
          data: [contactData]
        });
        this.logger.debug(`Created contact in Zoho: ${customer.email}`);
      }

    } catch (error) {
      this.logger.error(`Failed to sync customer ${customer.email} to Zoho`, error);
    }
  }

  async findContactByEmail(email) {
    try {
      const response = await this.makeRequest('GET', `/Contacts/search?email=${encodeURIComponent(email)}`);
      return response.data.data?.[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find contact by email ${email}`, error);
      return null;
    }
  }

  // Lead management methods
  async createLead(leadData) {
    try {
      this.logger.info(`Creating lead in Zoho CRM: ${leadData.email}`);
      
      const zohoLeadData = {
        First_Name: leadData.firstName || '',
        Last_Name: leadData.lastName || '',
        Email: leadData.email,
        Phone: leadData.phone || '',
        Company: leadData.company || '',
        Lead_Source: leadData.source || 'Website',
        Industry: leadData.industry || '',
        Description: leadData.description || '',
        Custom_Fields: {
          Organization_ID: this.clientId,
          Lead_ID: leadData.id
        }
      };

      const response = await this.makeRequest('POST', '/Leads', {
        data: [zohoLeadData]
      });

      const createdLead = response.data.data[0];
      this.logger.info(`Lead created in Zoho CRM: ${createdLead.id}`);
      
      return createdLead;

    } catch (error) {
      this.logger.error('Failed to create lead in Zoho CRM', error);
      throw error;
    }
  }

  async updateLeadStatus(leadId, status) {
    try {
      const response = await this.makeRequest('PUT', `/Leads/${leadId}`, {
        data: [{
          id: leadId,
          Lead_Status: status
        }]
      });

      this.logger.info(`Lead status updated in Zoho CRM: ${leadId} -> ${status}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to update lead status for ${leadId}`, error);
      throw error;
    }
  }

  // Deal tracking methods
  async createDeal(dealData) {
    try {
      this.logger.info(`Creating deal in Zoho CRM: ${dealData.name}`);
      
      const zohoDealData = {
        Deal_Name: dealData.name,
        Amount: dealData.amount,
        Stage: dealData.stage || 'Prospecting',
        Closing_Date: dealData.closingDate || new Date().toISOString().split('T')[0],
        Description: dealData.description || '',
        Custom_Fields: {
          Organization_ID: this.clientId,
          Deal_ID: dealData.id,
          Customer_ID: dealData.customerId
        }
      };

      const response = await this.makeRequest('POST', '/Deals', {
        data: [zohoDealData]
      });

      const createdDeal = response.data.data[0];
      this.logger.info(`Deal created in Zoho CRM: ${createdDeal.id}`);
      
      return createdDeal;

    } catch (error) {
      this.logger.error('Failed to create deal in Zoho CRM', error);
      throw error;
    }
  }

  async updateDealStage(dealId, stage) {
    try {
      const response = await this.makeRequest('PUT', `/Deals/${dealId}`, {
        data: [{
          id: dealId,
          Stage: stage
        }]
      });

      this.logger.info(`Deal stage updated in Zoho CRM: ${dealId} -> ${stage}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to update deal stage for ${dealId}`, error);
      throw error;
    }
  }

  // Sync methods
  async syncLeadsFromZoho() {
    try {
      this.logger.info('Starting lead sync from Zoho CRM');
      
      const response = await this.makeRequest('GET', '/Leads?per_page=200');
      const leads = response.data.data;

      for (const lead of leads) {
        await this.syncLeadFromZoho(lead);
      }

      this.logger.info(`Synced ${leads.length} leads from Zoho CRM`);
      return leads.length;
      
    } catch (error) {
      this.logger.error('Lead sync from Zoho CRM failed', error);
      throw error;
    }
  }

  async syncLeadFromZoho(zohoLead) {
    try {
      // Check if lead already exists locally
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          zohoId: zohoLead.id,
          organizationId: this.clientId
        }
      });

      const leadData = {
        zohoId: zohoLead.id,
        firstName: zohoLead.First_Name || '',
        lastName: zohoLead.Last_Name || '',
        email: zohoLead.Email || '',
        phone: zohoLead.Phone || '',
        company: zohoLead.Company || '',
        source: zohoLead.Lead_Source || '',
        industry: zohoLead.Industry || '',
        status: zohoLead.Lead_Status || '',
        description: zohoLead.Description || '',
        organizationId: this.clientId,
        metadata: {
          zohoData: zohoLead,
          lastSync: new Date().toISOString()
        }
      };

      if (existingLead) {
        await this.prisma.lead.update({
          where: { id: existingLead.id },
          data: leadData
        });
        this.logger.debug(`Updated lead from Zoho: ${zohoLead.Email}`);
      } else {
        await this.prisma.lead.create({
          data: leadData
        });
        this.logger.debug(`Created lead from Zoho: ${zohoLead.Email}`);
      }

    } catch (error) {
      this.logger.error(`Failed to sync lead ${zohoLead.Email} from Zoho`, error);
    }
  }

  // Periodic sync
  startPeriodicSync() {
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncLeadsFromZoho();
        await this.syncCustomersToZoho();
      } catch (error) {
        this.logger.error('Periodic sync failed', error);
      }
    }, this.syncInterval);

    this.logger.info(`Started periodic sync every ${this.syncInterval / 1000} seconds`);
  }

  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.logger.info('Stopped periodic sync');
    }
  }

  // Analytics and reporting
  async getSalesAnalytics(startDate, endDate) {
    try {
      const params = new URLSearchParams({
        created_time: `${startDate},${endDate}`,
        per_page: 200
      });

      const response = await this.makeRequest('GET', `/Deals?${params}`);
      const deals = response.data.data;

      const analytics = {
        totalDeals: deals.length,
        totalValue: deals.reduce((sum, deal) => sum + (parseFloat(deal.Amount) || 0), 0),
        wonDeals: deals.filter(deal => deal.Stage === 'Closed Won').length,
        lostDeals: deals.filter(deal => deal.Stage === 'Closed Lost').length,
        averageDealSize: 0,
        stageBreakdown: {}
      };

      analytics.averageDealSize = analytics.totalValue / analytics.totalDeals;

      // Count deals by stage
      deals.forEach(deal => {
        const stage = deal.Stage || 'Unknown';
        analytics.stageBreakdown[stage] = (analytics.stageBreakdown[stage] || 0) + 1;
      });

      return analytics;

    } catch (error) {
      this.logger.error('Failed to get sales analytics', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.testConnection();
      return { 
        status: 'healthy', 
        environment: this.environment,
        dataCenter: this.dataCenter,
        tokenExpiry: this.tokenExpiry,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  async cleanup() {
    this.logger.info('Cleaning up Zoho CRM integration');
    this.stopPeriodicSync();
    this.initialized = false;
  }
}

module.exports = ZohoCRMIntegration;
