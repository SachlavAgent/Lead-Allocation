// clickup-integration.js

const axios = require('axios');

// Replace with your ClickUp API token
const API_TOKEN = 'your_clickup_api_token';
const CLICKUP_LIST_ID = '90182398669';
const SALESPEOPLE = ['salesperson1', 'salesperson2', 'salesperson3']; // List of salespeople

// Function to fetch unassigned leads
async function fetchUnassignedLeads() {
    try {
        const response = await axios.get(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
            headers: {
                'Authorization': API_TOKEN,
            },
        });
        return response.data.tasks.filter(task => !task.assignees || task.assignees.length === 0);
    } catch (error) {
        console.error('Error fetching unassigned leads:', error);
        return [];
    }
}

// Function to assign leads to salespeople based on calculated allocations
async function assignLeadsToSalespeople() {
    const unassignedLeads = await fetchUnassignedLeads();
    const allocations = calculateAllocations(unassignedLeads.length);

    let leadIndex = 0;

    for (const salesperson of SALESPEOPLE) {
        for (let i = 0; i < allocations[salesperson]; i++) {
            if (leadIndex < unassignedLeads.length) {
                await assignLead(unassignedLeads[leadIndex].id, salesperson);
                leadIndex++;
            } else {
                break;
            }
        }
    }
}

function calculateAllocations(totalLeads) {
    const allocations = {};
    const baseAllocation = Math.floor(totalLeads / SALESPEOPLE.length);
    const remainder = totalLeads % SALESPEOPLE.length;

    SALESPEOPLE.forEach((salesperson, index) => {
        allocations[salesperson] = baseAllocation + (index < remainder ? 1 : 0);
    });
    return allocations;
}

async function assignLead(leadId, salesperson) {
    try {
        await axios.put(`https://api.clickup.com/api/v2/task/${leadId}`, {
            assignees: [salesperson],
        }, {
            headers: {
                'Authorization': API_TOKEN,
            },
        });
        console.log(`Assigned lead ${leadId} to ${salesperson}`);
    } catch (error) {
        console.error(`Error assigning lead ${leadId} to ${salesperson}:`, error);
    }
}

// Run the assignment process
assignLeadsToSalespeople();
