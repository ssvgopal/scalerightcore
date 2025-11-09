const axios = require('axios');

class ZohoCRMService {
  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.redirectUri = process.env.ZOHO_REDIRECT_URI;
    this.baseUrl = 'https://www.zohoapis.com/crm/v2';
    this.authUrl = 'https://accounts.zoho.com/oauth/v2';
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.authUrl}/token`, null, {
        params: {
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      return {
        success: true,
        accessToken: this.accessToken,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Zoho token refresh failed:', error);
      return {
        success: false,
        error: error.response?.data?.error_description || error.message
      };
    }
  }

  async getAccessToken() {
    if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
      const refreshResult = await this.refreshAccessToken();
      if (!refreshResult.success) {
        throw new Error(`Token refresh failed: ${refreshResult.error}`);
      }
    }
    return this.accessToken;
  }

  async makeAuthenticatedRequest(method, endpoint, data = null) {
    try {
      const token = await this.getAccessToken();
      
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Zoho API request failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: error.response?.status
      };
    }
  }

  async createLead(leadData) {
    try {
      const result = await this.makeAuthenticatedRequest(
        'POST',
        '/Leads',
        {
          data: [leadData]
        }
      );

      if (result.success) {
        return {
          success: true,
          leadId: result.data.data[0].details.id,
          message: 'Lead created successfully'
        };
      }

      return result;
    } catch (error) {
      console.error('Lead creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateLead(leadId, leadData) {
    try {
      const result = await this.makeAuthenticatedRequest(
        'PUT',
        `/Leads/${leadId}`,
        {
          data: [leadData]
        }
      );

      if (result.success) {
        return {
          success: true,
          leadId: result.data.data[0].details.id,
          message: 'Lead updated successfully'
        };
      }

      return result;
    } catch (error) {
      console.error('Lead update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getLead(leadId) {
    try {
      const result = await this.makeAuthenticatedRequest('GET', `/Leads/${leadId}`);
      
      if (result.success) {
        return {
          success: true,
          lead: result.data.data[0]
        };
      }

      return result;
    } catch (error) {
      console.error('Lead fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchLeads(criteria) {
    try {
      const query = Object.entries(criteria)
        .map(([key, value]) => `${key}:equals:${value}`)
        .join(' and ');

      const result = await this.makeAuthenticatedRequest(
        'GET',
        `/Leads/search?criteria=${encodeURIComponent(query)}`
      );

      if (result.success) {
        return {
          success: true,
          leads: result.data.data,
          count: result.data.info.count
        };
      }

      return result;
    } catch (error) {
      console.error('Lead search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createContact(contactData) {
    try {
      const result = await this.makeAuthenticatedRequest(
        'POST',
        '/Contacts',
        {
          data: [contactData]
        }
      );

      if (result.success) {
        return {
          success: true,
          contactId: result.data.data[0].details.id,
          message: 'Contact created successfully'
        };
      }

      return result;
    } catch (error) {
      console.error('Contact creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createDeal(dealData) {
    try {
      const result = await this.makeAuthenticatedRequest(
        'POST',
        '/Deals',
        {
          data: [dealData]
        }
      );

      if (result.success) {
        return {
          success: true,
          dealId: result.data.data[0].details.id,
          message: 'Deal created successfully'
        };
      }

      return result;
    } catch (error) {
      console.error('Deal creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getModuleFields(module) {
    try {
      const result = await this.makeAuthenticatedRequest(
        'GET',
        `/${module}/fields`
      );

      if (result.success) {
        return {
          success: true,
          fields: result.data.fields
        };
      }

      return result;
    } catch (error) {
      console.error('Module fields fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async bulkSyncLeads(leads) {
    try {
      const results = {
        successful: [],
        failed: [],
        errors: []
      };

      for (const lead of leads) {
        try {
          const result = await this.createLead(lead);
          if (result.success) {
            results.successful.push({
              localId: lead.id,
              zohoId: result.leadId,
              email: lead.Email
            });
          } else {
            results.failed.push({
              localId: lead.id,
              email: lead.Email,
              error: result.error
            });
          }
        } catch (error) {
          results.errors.push({
            localId: lead.id,
            email: lead.Email,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results,
        summary: {
          total: leads.length,
          successful: results.successful.length,
          failed: results.failed.length,
          errors: results.errors.length
        }
      };
    } catch (error) {
      console.error('Bulk lead sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async resolveConflict(localData, zohoData, conflictFields) {
    try {
      const resolution = {};
      const conflicts = [];

      for (const field of conflictFields) {
        const localValue = localData[field];
        const zohoValue = zohoData[field];

        if (localValue !== zohoValue) {
          conflicts.push({
            field,
            local: localValue,
            zoho: zohoValue
          });

          // Simple conflict resolution: prefer Zoho data for most fields
          // In production, this would be more sophisticated
          if (field === 'Last_Name' || field === 'Company') {
            resolution[field] = zohoValue; // Prefer Zoho for critical fields
          } else if (field === 'Lead_Source') {
            resolution[field] = localValue; // Prefer local for source tracking
          } else {
            resolution[field] = zohoValue; // Default to Zoho
          }
        } else {
          resolution[field] = localValue;
        }
      }

      return {
        success: true,
        resolution,
        conflicts,
        resolved: conflicts.length === 0
      };
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getSyncStatus() {
    try {
      const token = await this.getAccessToken();
      return {
        success: true,
        status: {
          authenticated: !!token,
          tokenExpiry: this.tokenExpiry,
          timeToExpiry: this.tokenExpiry ? this.tokenExpiry - Date.now() : null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ZohoCRMService;
