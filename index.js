// ============================================
// PARTE 1/4 - CONFIGURAÇÃO, ESTRUTURA E BANCO DE DADOS
// ============================================

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================
// CONFIGURAÇÃO INICIAL
// ============================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

if (!process.env.TOKEN) {
    console.error('❌ TOKEN não encontrado no arquivo .env');
    process.exit(1);
}

if (!process.env.OWNER_ID) {
    console.error('❌ OWNER_ID não encontrado no arquivo .env');
    process.exit(1);
}

const OWNER_ID = process.env.OWNER_ID;
const PREFIX = '\'';
const MAX_PRICE = 130000;

// ============================================
// BANCO DE DADOS (JSON)
// ============================================

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'guilds.json');
const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');
const BLOCKED_PLATES_FILE = path.join(DATA_DIR, 'blocked_plates.json');
const WEBHOOK_FILE = path.join(DATA_DIR, 'webhook.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Database {
    constructor() {
        this.guilds = new Map();
        this.vehicles = new Map();
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                this.guilds = new Map(Object.entries(data));
                console.log(`✅ Carregadas configurações de ${this.guilds.size} servidores`);
            } else {
                console.log('📁 Nenhum arquivo de configuração encontrado.');
            }

            if (fs.existsSync(VEHICLES_FILE)) {
                const data = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));
                this.vehicles = new Map(Object.entries(data));
                console.log(`✅ Carregados ${this.vehicles.size} veículos registrados`);
            } else {
                console.log('📁 Nenhum arquivo de veículos encontrado.');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
        }
    }

    saveData() {
        try {
            const guildsObj = Object.fromEntries(this.guilds);
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(guildsObj, null, 2));
            
            const vehiclesObj = Object.fromEntries(this.vehicles);
            fs.writeFileSync(VEHICLES_FILE, JSON.stringify(vehiclesObj, null, 2));
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados:', error);
            return false;
        }
    }

    getGuildConfig(guildId) {
        return this.guilds.get(guildId) || { registrationChannelId: null, vehiclesChannelId: null };
    }

    setRegistrationChannel(guildId, channelId) {
        const config = this.getGuildConfig(guildId);
        config.registrationChannelId = channelId;
        this.guilds.set(guildId, config);
        this.saveData();
    }

    setVehiclesChannel(guildId, channelId) {
        const config = this.getGuildConfig(guildId);
        config.vehiclesChannelId = channelId;
        this.guilds.set(guildId, config);
        this.saveData();
    }

    addVehicle(vehicleId, vehicleData) {
        this.vehicles.set(vehicleId, vehicleData);
        this.saveData();
    }

    getVehicle(vehicleId) {
        return this.vehicles.get(vehicleId);
    }

    getAllVehicles(guildId) {
        const vehicles = [];
        for (const [id, data] of this.vehicles) {
            if (data.guildId === guildId) {
                vehicles.push({ id, ...data });
            }
        }
        return vehicles;
    }

    isPlateDuplicate(guildId, plate) {
        for (const [id, data] of this.vehicles) {
            if (data.guildId === guildId && data.plate === plate) {
                return true;
            }
        }
        return false;
    }

    generateVehicleId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `VEH-${timestamp}-${random}`;
    }
}

const db = new Database();

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function isOwner(userId) {
    return userId === OWNER_ID;
}

function formatPriceUSD(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

function parsePrice(input) {
    let cleaned = input.replace(/[^0-9.,]/g, '');
    cleaned = cleaned.replace(/,/g, '.');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
    return parseFloat(cleaned);
}

function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Registro de Veículos' });
}

function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x44FF44)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Registro de Veículos' });
}

function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x44AAFF)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Registro de Veículos' });
}

function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xFFAA44)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Registro de Veículos' });
}

function createRegistrationEmbed() {
    const embed = new EmbedBuilder()
        .setColor(0xAA44FF)
        .setTitle('🚗 Sistema de Registro de Veículos')
        .setDescription(`
Bem-vindo ao sistema de registro de veículos do **Vehix**!

Para registrar um novo veículo em nossa plataforma, clique no botão abaixo e preencha o formulário.

**Instruções:**
• Tenha em mãos a imagem do veículo
• Preencha todos os campos corretamente
• Após o registro, o veículo aparecerá no canal designado

📋 **Campos obrigatórios:**
- Placa (Case Sensitive - respeite maiúsculas/minúsculas)
- Modelo completo
- Cor
- Ano (apenas números)
- Preço (máximo ${formatPriceUSD(MAX_PRICE)} USD)

✨ **Benefícios do sistema:**
✔️ Organização profissional
✔️ Registro seguro
✔️ Acesso rápido às informações
✔️ Galeria de veículos organizada

Clique no botão abaixo para iniciar seu registro!
        `)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Registro de Veículos • Clique no botão para começar' });
    
    return embed;
}

function createVehicleEmbed(vehicleData, user) {
    const { model, color, year, price, plate, vehicleId } = vehicleData;
    const formattedPrice = formatPriceUSD(parseFloat(price));
    
    const embed = new EmbedBuilder()
        .setColor(0x44AAFF)
        .setTitle('🚗 Veículo Registrado')
        .setDescription(`
**👤 Dono:** ${user.toString()}
**🚘 Modelo:** ${model}
**🎨 Cor:** ${color}
**📅 Ano:** ${year}
**💰 Preço:** ${formattedPrice}
**🔢 Placa:** ${plate}
**🆔 ID:** \`${vehicleId}\`

✅ Veículo registrado com sucesso no sistema!
        `)
        .setTimestamp()
        .setFooter({ text: `Vehix - Sistema de Registro • ID: ${vehicleId}` });
    
    return embed;
}

function generateStatsEmbed(guild) {
    const config = db.getGuildConfig(guild.id);
    const vehicles = db.getAllVehicles(guild.id);
    
    const totalVehicles = vehicles.length;
    const uniqueModels = new Set(vehicles.map(v => v.model.toLowerCase())).size;
    const yearRange = vehicles.length > 0 ? {
        min: Math.min(...vehicles.map(v => parseInt(v.year))),
        max: Math.max(...vehicles.map(v => parseInt(v.year)))
    } : { min: 0, max: 0 };
    
    const avgPrice = vehicles.length > 0 
        ? vehicles.reduce((sum, v) => sum + parseFloat(v.price), 0) / vehicles.length
        : 0;
    
    const embed = new EmbedBuilder()
        .setColor(0x44AAFF)
        .setTitle('📊 Estatísticas do Vehix')
        .setDescription(`Estatísticas detalhadas do servidor **${guild.name}**`)
        .addFields(
            { name: '📌 Configurações', value: `
• Canal de registro: ${config.registrationChannelId ? `<#${config.registrationChannelId}>` : '❌ Não configurado'}
• Canal de veículos: ${config.vehiclesChannelId ? `<#${config.vehiclesChannelId}>` : '❌ Não configurado'}
            `, inline: false },
            { name: '🚗 Veículos', value: `
• Total registrado: **${totalVehicles}**
• Modelos únicos: **${uniqueModels}**
• Ano mais antigo: **${yearRange.min || 'N/A'}**
• Ano mais novo: **${yearRange.max || 'N/A'}**
• Preço médio: **${formatPriceUSD(avgPrice)}**
• Limite máximo: **${formatPriceUSD(MAX_PRICE)}**
            `, inline: false },
            { name: '📈 Desempenho', value: `
• Uptime: ${Math.floor(process.uptime() / 86400)} dias
• Memória: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
            `, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Vehix • ${new Date().toLocaleString('pt-BR')}` });
    
    return embed;
}

function exportGuildData(guildId) {
    const vehicles = db.getAllVehicles(guildId);
    const config = db.getGuildConfig(guildId);
    
    const exportData = {
        exportedAt: new Date().toISOString(),
        guildId: guildId,
        config: config,
        vehicles: vehicles,
        totalVehicles: vehicles.length,
        summary: {
            models: [...new Set(vehicles.map(v => v.model))],
            colors: [...new Set(vehicles.map(v => v.color))],
            years: [...new Set(vehicles.map(v => v.year))].sort(),
            priceRange: vehicles.length > 0 ? {
                min: Math.min(...vehicles.map(v => parseFloat(v.price))),
                max: Math.max(...vehicles.map(v => parseFloat(v.price)))
            } : null
        }
    };
    
    const fileName = `export_${guildId}_${Date.now()}.json`;
    const filePath = path.join(DATA_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    
    return filePath;
}

// ============================================
// SISTEMA DE MODERAÇÃO DE PLACAS
// ============================================

class PlateModeration {
    constructor() {
        this.blockedPlates = new Map();
        this.pendingReports = new Map();
        this.loadBlockedPlates();
    }
    
    loadBlockedPlates() {
        try {
            if (fs.existsSync(BLOCKED_PLATES_FILE)) {
                const data = JSON.parse(fs.readFileSync(BLOCKED_PLATES_FILE, 'utf8'));
                for (const [guildId, plates] of Object.entries(data)) {
                    this.blockedPlates.set(guildId, new Set(plates));
                }
                console.log(`✅ Carregadas ${this.blockedPlates.size} listas de placas bloqueadas`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar placas bloqueadas:', error);
        }
    }
    
    saveBlockedPlates() {
        try {
            const data = {};
            for (const [guildId, plates] of this.blockedPlates) {
                data[guildId] = Array.from(plates);
            }
            fs.writeFileSync(BLOCKED_PLATES_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar placas bloqueadas:', error);
        }
    }
    
    isPlateBlocked(guildId, plate) {
        const blocked = this.blockedPlates.get(guildId);
        return blocked ? blocked.has(plate) : false;
    }
    
    blockPlate(guildId, plate, reason, moderatorId) {
        if (!this.blockedPlates.has(guildId)) {
            this.blockedPlates.set(guildId, new Set());
        }
        
        const blocked = this.blockedPlates.get(guildId);
        blocked.add(plate);
        this.saveBlockedPlates();
        
        logger.moderation('bloqueio', plate, moderatorId, reason);
        return true;
    }
    
    unblockPlate(guildId, plate) {
        const blocked = this.blockedPlates.get(guildId);
        if (blocked && blocked.has(plate)) {
            blocked.delete(plate);
            this.saveBlockedPlates();
            logger.moderation('desbloqueio', plate, 'Sistema');
            return true;
        }
        return false;
    }
    
    getBlockedPlates(guildId) {
        const blocked = this.blockedPlates.get(guildId);
        return blocked ? Array.from(blocked) : [];
    }
}

const plateModeration = new PlateModeration();

// ============================================
// SISTEMA DE BACKUP AUTOMÁTICO
// ============================================

const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupSystem {
    constructor() {
        this.backupInterval = null;
        this.startAutoBackup();
    }

    startAutoBackup() {
        this.backupInterval = setInterval(() => {
            this.createBackup();
        }, 24 * 60 * 60 * 1000);
        
        console.log('🔄 Sistema de backup automático iniciado (a cada 24 horas)');
    }

    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `backup_${timestamp}.json`;
            const backupPath = path.join(BACKUP_DIR, backupFileName);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                guilds: Object.fromEntries(db.guilds),
                vehicles: Object.fromEntries(db.vehicles),
                blockedPlates: (() => {
                    const data = {};
                    for (const [guildId, plates] of plateModeration.blockedPlates) {
                        data[guildId] = Array.from(plates);
                    }
                    return data;
                })(),
                stats: {
                    totalGuilds: db.guilds.size,
                    totalVehicles: db.vehicles.size
                }
            };
            
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            console.log(`✅ Backup criado: ${backupFileName}`);
            
            this.cleanOldBackups();
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
        }
    }

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR);
            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            
            files.forEach(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtimeMs < sevenDaysAgo) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Backup antigo removido: ${file}`);
                }
            });
        } catch (error) {
            console.error('❌ Erro ao limpar backups antigos:', error);
        }
    }

    restoreBackup(backupFileName) {
        try {
            const backupPath = path.join(BACKUP_DIR, backupFileName);
            if (!fs.existsSync(backupPath)) {
                throw new Error('Arquivo de backup não encontrado');
            }
            
            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
            db.guilds = new Map(Object.entries(backupData.guilds));
            db.vehicles = new Map(Object.entries(backupData.vehicles));
            db.saveData();
            
            if (backupData.blockedPlates) {
                for (const [guildId, plates] of Object.entries(backupData.blockedPlates)) {
                    plateModeration.blockedPlates.set(guildId, new Set(plates));
                }
                plateModeration.saveBlockedPlates();
            }
            
            console.log(`✅ Backup restaurado: ${backupFileName}`);
            logger.backup('restaurado', backupFileName);
            return true;
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            return false;
        }
    }

    listBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR);
            return files.filter(file => file.endsWith('.json')).sort().reverse();
        } catch (error) {
            console.error('❌ Erro ao listar backups:', error);
            return [];
        }
    }
}

const backupSystem = new BackupSystem();

// ============================================
// SISTEMA DE LOGS
// ============================================

const LOGS_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

class Logger {
    constructor() {
        this.logFile = path.join(LOGS_DIR, `vehix_${new Date().toISOString().split('T')[0]}.log`);
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}\n`;
        
        console.log(logMessage.trim());
        
        try {
            fs.appendFileSync(this.logFile, logMessage);
        } catch (error) {
            console.error('Erro ao escrever log:', error);
        }
    }

    error(message) { this.log(message, 'ERROR'); }
    warn(message) { this.log(message, 'WARN'); }
    success(message) { this.log(message, 'SUCCESS'); }

    vehicleRegistered(vehicleData, user) {
        this.log(`Veículo registrado - ID: ${vehicleData.vehicleId} | Placa: ${vehicleData.plate} | Modelo: ${vehicleData.model} | Dono: ${user.tag} (${user.id}) | Servidor: ${vehicleData.guildId} | Preço: ${formatPriceUSD(parseFloat(vehicleData.price))}`, 'VEHICLE');
    }
    
    backup(action, details) {
        this.log(`Backup ${action}: ${details}`, 'BACKUP');
    }
    
    moderation(action, target, moderator, reason) {
        this.log(`Moderação ${action}: ${target} por ${moderator}${reason ? ` - Motivo: ${reason}` : ''}`, 'MODERATION');
    }
}

const logger = new Logger();

// ============================================
// SISTEMA DE WEBHOOK
// ============================================

class WebhookManager {
    constructor() {
        this.webhookUrl = null;
        this.loadWebhook();
    }
    
    loadWebhook() {
        try {
            if (fs.existsSync(WEBHOOK_FILE)) {
                const data = JSON.parse(fs.readFileSync(WEBHOOK_FILE, 'utf8'));
                this.webhookUrl = data.url;
                console.log('✅ Webhook carregado');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar webhook:', error);
        }
    }
    
    saveWebhook(url) {
        this.webhookUrl = url;
        fs.writeFileSync(WEBHOOK_FILE, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2));
    }
    
    async sendNotification(title, message, color = 0x44AAFF) {
        if (!this.webhookUrl) return;
        
        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(message)
                .setTimestamp()
                .setFooter({ text: 'Vehix - Sistema de Notificações' });
            
            const { WebhookClient } = require('discord.js');
            const webhookClient = new WebhookClient({ url: this.webhookUrl });
            await webhookClient.send({ embeds: [embed] });
            await webhookClient.destroy();
        } catch (error) {
            console.error('❌ Erro ao enviar webhook:', error);
        }
    }
    
    async notifyVehicleRegistered(vehicleData, user, guild) {
        if (!this.webhookUrl) return;
        
        const message = `
**Novo veículo registrado!**

**Servidor:** ${guild.name} (${guild.id})
**Dono:** ${user.tag} (${user.id})
**Modelo:** ${vehicleData.model}
**Placa:** ${vehicleData.plate}
**Preço:** ${formatPriceUSD(parseFloat(vehicleData.price))}
**ID:** \`${vehicleData.vehicleId}\`
        `;
        
        await this.sendNotification('🚗 Novo Registro de Veículo', message, 0x44FF44);
    }
    
    async notifyGuildJoin(guild) {
        if (!this.webhookUrl) return;
        const owner = await guild.fetchOwner();
        await this.sendNotification('➕ Novo Servidor', `**${guild.name}** (${guild.id})\nMembros: ${guild.memberCount}\nDono: ${owner.user.tag}`, 0x44FF44);
    }
    
    async notifyGuildLeave(guild) {
        if (!this.webhookUrl) return;
        await this.sendNotification('➖ Servidor Removido', `**${guild.name}** (${guild.id})\nO bot foi removido deste servidor.`, 0xFF4444);
    }
}

const webhookManager = new WebhookManager();

// ============================================
// SISTEMA DE MANUTENÇÃO E LIMPEZA
// ============================================

class MaintenanceSystem {
    constructor() {
        this.maintenanceMode = false;
        this.scheduledCleanup = null;
        this.startScheduledCleanup();
    }
    
    startScheduledCleanup() {
        setInterval(() => {
            const now = new Date();
            if (now.getDay() === 0 && now.getHours() === 3) {
                this.cleanOldRecords();
            }
        }, 60 * 60 * 1000);
        
        console.log('🧹 Sistema de manutenção agendada iniciado');
    }
    
    async cleanOldRecords() {
        console.log('🧹 Iniciando limpeza de registros antigos...');
        
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        let removedCount = 0;
        
        for (const [vehicleId, vehicle] of db.vehicles) {
            const registeredDate = new Date(vehicle.registeredAt).getTime();
            if (registeredDate < thirtyDaysAgo) {
                db.vehicles.delete(vehicleId);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            db.saveData();
            logger.log(`Limpeza automática: ${removedCount} registros antigos removidos`, 'MAINTENANCE');
            
            await webhookManager.sendNotification(
                '🧹 Limpeza Automática Concluída',
                `**${removedCount}** registros de veículos com mais de 30 dias foram removidos do sistema.`,
                0xFFA500
            );
        }
        
        console.log(`✅ Limpeza concluída: ${removedCount} registros removidos`);
        return removedCount;
    }
    
    async cleanOrphanData() {
        let removedCount = 0;
        
        for (const [vehicleId, vehicle] of db.vehicles) {
            try {
                const guild = await client.guilds.fetch(vehicle.guildId).catch(() => null);
                if (!guild) {
                    db.vehicles.delete(vehicleId);
                    removedCount++;
                    continue;
                }
                
                const member = await guild.members.fetch(vehicle.userId).catch(() => null);
                if (!member) {
                    db.vehicles.delete(vehicleId);
                    removedCount++;
                }
            } catch (error) {
                console.error(`Erro ao verificar veículo ${vehicleId}:`, error);
            }
        }
        
        if (removedCount > 0) {
            db.saveData();
            logger.log(`Limpeza de dados órfãos: ${removedCount} registros removidos`, 'MAINTENANCE');
        }
        
        return removedCount;
    }
    
    async cleanupUsers(guild) {
        const vehicles = db.getAllVehicles(guild.id);
        let removedCount = 0;
        
        for (const vehicle of vehicles) {
            try {
                const member = await guild.members.fetch(vehicle.userId);
                if (!member) {
                    db.vehicles.delete(vehicle.id);
                    removedCount++;
                }
            } catch (error) {
                db.vehicles.delete(vehicle.id);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            db.saveData();
            logger.log(`Limpeza de usuários ausentes: ${removedCount} registros removidos do servidor ${guild.id}`, 'MAINTENANCE');
        }
        
        return removedCount;
    }
}

const maintenanceSystem = new MaintenanceSystem();
// ============================================
// PARTE 2/4 - COMANDOS SLASH E HANDLER DO MODAL
// ============================================

// ============================================
// COMANDOS SLASH (APENAS DONO)
// ============================================

const commands = [
    new SlashCommandBuilder()
        .setName('register')
        .setDescription('Configura o canal onde o bot enviará o embed de registro de veículos')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Selecione o canal para enviar o registro')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('registered')
        .setDescription('Configura o canal onde os veículos registrados serão enviados')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Selecione o canal para os veículos registrados')
                .setRequired(true)
        )
];

// ============================================
// HANDLER DO MODAL DE REGISTRO
// ============================================

async function handleVehicleModal(interaction) {
    const plate = interaction.fields.getTextInputValue('plate');
    const model = interaction.fields.getTextInputValue('model');
    const color = interaction.fields.getTextInputValue('color');
    const year = interaction.fields.getTextInputValue('year');
    const priceRaw = interaction.fields.getTextInputValue('price');
    
    // Validar placa (case sensitive)
    if (!plate || plate.length < 4 || plate.length > 10) {
        const embed = createErrorEmbed('Placa Inválida', 'A placa do veículo deve ter entre 4 e 10 caracteres.');
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Verificar placa bloqueada
    if (plateModeration.isPlateBlocked(interaction.guild.id, plate)) {
        const embed = createErrorEmbed('Placa Bloqueada', `A placa **${plate}** está bloqueada pela moderação.\n\nNão é possível registrar veículos com esta placa.`);
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Verificar placa duplicada
    if (db.isPlateDuplicate(interaction.guild.id, plate)) {
        const embed = createErrorEmbed('Placa Duplicada', `A placa **${plate}** já está registrada no sistema.\n\nPor favor, verifique os dados e tente novamente.`);
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Validar modelo
    if (!model || model.length < 2 || model.length > 50) {
        const embed = createErrorEmbed('Modelo Inválido', 'O modelo deve ter entre 2 e 50 caracteres.');
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Validar cor
    if (!color || color.length < 2 || color.length > 30) {
        const embed = createErrorEmbed('Cor Inválida', 'A cor deve ter entre 2 e 30 caracteres.');
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Validar ano
    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || year.length !== 4 || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
        const embed = createErrorEmbed('Ano Inválido', `Por favor, insira um ano válido (1900-${new Date().getFullYear() + 1}).`);
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Validar preço
    const priceValue = parsePrice(priceRaw);
    if (isNaN(priceValue) || priceValue <= 0) {
        const embed = createErrorEmbed('Preço Inválido', 'Por favor, insira um preço válido (apenas números).\nExemplos: 50000, 75,000, 130000, $130,000');
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Verificar limite máximo
    if (priceValue > MAX_PRICE) {
        const embed = createErrorEmbed('Preço Excede o Limite', `O preço máximo permitido é **${formatPriceUSD(MAX_PRICE)}**.\n\nVocê tentou registrar por **${formatPriceUSD(priceValue)}**.\n\nPor favor, insira um valor dentro do limite permitido.`);
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Armazenar dados temporariamente
    const tempData = {
        plate: plate,
        model: model,
        color: color,
        year: year,
        price: priceValue.toString(),
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        timestamp: Date.now()
    };
    
    // Criar coletor para imagem
    const embed = createInfoEmbed('📸 Envie a Imagem do Veículo', `Por favor, envie a **IMAGEM** do veículo **${model}** (Placa: ${plate}) neste chat.\n\n` +
        `**Instruções:**\n` +
        `• A imagem deve ser enviada como **ANEXO** (upload)\n` +
        `• **NÃO** envie links de imagem\n` +
        `• Formatos aceitos: PNG, JPG, JPEG, GIF, WEBP\n` +
        `• Você tem **5 minutos** para enviar a imagem\n\n` +
        `⚠️ **Importante:** Apenas uma imagem será aceita. Caso envie mais de uma, apenas a primeira será considerada.\n\n` +
        `Para cancelar, digite \`cancelar\` ou aguarde o timeout.`);
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    
    // Configurar coletor de mensagens
    const filter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0;
    const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });
    
    collector.on('collect', async (message) => {
        const attachment = message.attachments.first();
        
        if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
            const errorEmbed = createErrorEmbed('Formato Inválido', 'O arquivo enviado não é uma imagem válida.\n\nPor favor, envie uma imagem nos formatos: PNG, JPG, JPEG, GIF ou WEBP.');
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            collector.stop();
            return;
        }
        
        if (attachment.size > 10 * 1024 * 1024) {
            const errorEmbed = createErrorEmbed('Imagem Muito Grande', 'A imagem deve ter no máximo 10MB.\n\nPor favor, envie uma imagem menor.');
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            collector.stop();
            return;
        }
        
        const config = db.getGuildConfig(interaction.guild.id);
        if (!config.vehiclesChannelId) {
            const errorEmbed = createErrorEmbed('Canal Não Configurado', 'O canal para veículos registrados não foi configurado.\n\nPor favor, peça ao administrador para usar o comando `/registered` primeiro.');
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            collector.stop();
            return;
        }
        
        const vehiclesChannel = interaction.guild.channels.cache.get(config.vehiclesChannelId);
        if (!vehiclesChannel) {
            const errorEmbed = createErrorEmbed('Canal Inválido', 'O canal configurado para veículos registrados não foi encontrado.\n\nPor favor, reconfigure o canal usando o comando `/registered`.');
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            collector.stop();
            return;
        }
        
        const botMember = interaction.guild.members.cache.get(client.user.id);
        const channelPermissions = vehiclesChannel.permissionsFor(botMember);
        
        if (!channelPermissions.has(PermissionsBitField.Flags.SendMessages) ||
            !channelPermissions.has(PermissionsBitField.Flags.AttachFiles) ||
            !channelPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
            const errorEmbed = createErrorEmbed('Permissões Insuficientes', `Não tenho permissões suficientes no canal ${vehiclesChannel.toString()}.\n\nNecessário:\n• Enviar mensagens\n• Anexar arquivos\n• Inserir links`);
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
            collector.stop();
            return;
        }
        
        const vehicleId = db.generateVehicleId();
        
        const vehicleData = {
            plate: tempData.plate,
            model: tempData.model,
            color: tempData.color,
            year: tempData.year,
            price: tempData.price,
            imageUrl: attachment.url,
            userId: tempData.userId,
            guildId: tempData.guildId,
            vehicleId: vehicleId,
            registeredAt: new Date().toISOString()
        };
        
        db.addVehicle(vehicleId, vehicleData);
        
        const vehicleEmbed = createVehicleEmbed(vehicleData, interaction.user);
        
        await vehiclesChannel.send({ files: [attachment.url], flags: 64 });
        await vehiclesChannel.send({ embeds: [vehicleEmbed] });
        
        await webhookManager.notifyVehicleRegistered(vehicleData, interaction.user, interaction.guild);
        logger.vehicleRegistered(vehicleData, interaction.user);
        
        const successEmbed = createSuccessEmbed('Veículo Registrado!', `✅ O veículo **${tempData.model}** (Placa: ${tempData.plate}) foi registrado com sucesso!\n\n` +
            `📌 **ID do registro:** \`${vehicleId}\`\n` +
            `📍 **Localização:** ${vehiclesChannel.toString()}\n` +
            `💰 **Preço:** ${formatPriceUSD(parseFloat(tempData.price))}\n\n` +
            `Obrigado por utilizar o sistema Vehix! 🚗`);
        
        await interaction.followUp({ embeds: [successEmbed], flags: 64 });
        
        try {
            await message.delete();
        } catch (err) {
            console.error('Erro ao apagar mensagem:', err);
        }
        
        collector.stop();
    });
    
    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = createErrorEmbed('Tempo Esgotado', 'Você demorou muito para enviar a imagem do veículo.\n\nPor favor, inicie o registro novamente clicando no botão "Registrar Veículo".');
            interaction.followUp({ embeds: [timeoutEmbed], flags: 64 }).catch(() => {});
        }
    });
}

// ============================================
// LISTAGEM DE VEÍCULOS COM PAGINAÇÃO
// ============================================

async function listVehiclesPaginated(interaction, vehicles, page = 0) {
    const itemsPerPage = 5;
    const totalPages = Math.ceil(vehicles.length / itemsPerPage);
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageVehicles = vehicles.slice(start, end);
    
    const embed = new EmbedBuilder()
        .setColor(0x44AAFF)
        .setTitle('📋 Lista de Veículos Registrados')
        .setDescription(`Total de veículos: **${vehicles.length}**\nPágina ${page + 1} de ${totalPages || 1}`)
        .setTimestamp();
    
    pageVehicles.forEach((vehicle, index) => {
        embed.addFields({
            name: `${start + index + 1}. ${vehicle.model} (${vehicle.plate})`,
            value: `🎨 Cor: ${vehicle.color}\n📅 Ano: ${vehicle.year}\n💰 Preço: ${formatPriceUSD(parseFloat(vehicle.price))}\n🆔 ID: \`${vehicle.id}\``,
            inline: false
        });
    });
    
    if (vehicles.length === 0) {
        embed.setDescription('Nenhum veículo registrado ainda.\n\nClique no botão "Registrar Veículo" para começar!');
    }
    
    const row = new ActionRowBuilder();
    
    if (page > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`list_prev_${page - 1}`)
                .setLabel('◀ Anterior')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    if (page < totalPages - 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`list_next_${page + 1}`)
                .setLabel('Próxima ▶')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    if (totalPages > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('list_refresh')
                .setLabel('🔄 Atualizar')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    const components = row.components.length > 0 ? [row] : [];
    
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components });
    } else {
        await interaction.reply({ embeds: [embed], components, flags: 64 });
    }
}

// ============================================
// BUSCA DE VEÍCULO COM EMBED
// ============================================

async function searchVehicle(interaction, searchTerm) {
    const vehicles = db.getAllVehicles(interaction.guild.id);
    
    const found = vehicles.find(v => 
        v.plate === searchTerm || 
        v.id.toLowerCase() === searchTerm.toLowerCase() ||
        v.id.includes(searchTerm)
    );
    
    if (!found) {
        const embed = createErrorEmbed('Veículo Não Encontrado', `Nenhum veículo encontrado com o termo "${searchTerm}".\n\nVerifique a placa ou ID e tente novamente.`);
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x44FF44)
        .setTitle('🔍 Veículo Encontrado')
        .setDescription(`
**👤 Dono:** <@${found.userId}>
**🚘 Modelo:** ${found.model}
**🎨 Cor:** ${found.color}
**📅 Ano:** ${found.year}
**💰 Preço:** ${formatPriceUSD(parseFloat(found.price))}
**🔢 Placa:** ${found.plate}
**🆔 ID:** \`${found.id}\`
**📅 Registrado em:** ${new Date(found.registeredAt).toLocaleString('pt-BR')}
        `)
        .setImage(found.imageUrl)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema de Busca' });
    
    await interaction.reply({ embeds: [embed], flags: 64 });
}
// ============================================
// PARTE 3/4 - EVENTOS E INTERAÇÕES
// ============================================

client.once('clientReady', async () => {
    console.log(`✅ Bot ${client.user.tag} está online!`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`👑 Dono do bot: ${OWNER_ID}`);
    console.log(`💰 Preço máximo permitido: ${formatPriceUSD(MAX_PRICE)} USD`);
    console.log(`🔠 Placas: Case Sensitive`);
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        
        console.log('🔄 Registrando comandos slash...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        
        console.log('✅ Comandos slash registrados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos slash:', error);
    }
    
    client.user.setPresence({
        activities: [{ name: `${PREFIX}ajuda | Limite ${formatPriceUSD(MAX_PRICE)}`, type: 3 }],
        status: 'online'
    });
});

client.on('interactionCreate', async (interaction) => {
    try {
        // Comandos slash
        if (interaction.isCommand()) {
            const { commandName, user, guild, options } = interaction;
            
            if (!isOwner(user.id)) {
                const embed = createErrorEmbed('Permissão Negada', `Você não tem permissão para usar este comando.\n\nApenas o <@${OWNER_ID}> pode configurar o sistema.`);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            
            if (commandName === 'register') {
                const channel = options.getChannel('canal');
                
                const botMember = guild.members.cache.get(client.user.id);
                const channelPermissions = channel.permissionsFor(botMember);
                
                if (!channelPermissions.has(PermissionsBitField.Flags.SendMessages)) {
                    const embed = createErrorEmbed('Permissão Insuficiente', `Não tenho permissão para enviar mensagens no canal ${channel.toString()}.`);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                
                if (!channelPermissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    const embed = createErrorEmbed('Permissão Insuficiente', `Não tenho permissão para ver o canal ${channel.toString()}.`);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                
                db.setRegistrationChannel(guild.id, channel.id);
                
                const embed = createRegistrationEmbed();
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('register_vehicle')
                            .setLabel('Registrar Veículo')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📝')
                    );
                
                await channel.send({ embeds: [embed], components: [row] });
                
                const successEmbed = createSuccessEmbed('Configuração Concluída', `✅ O embed de registro foi enviado com sucesso em ${channel.toString()}!\n\nO sistema está pronto para receber registros de veículos.\n💰 Limite máximo: ${formatPriceUSD(MAX_PRICE)} USD\n🔠 Placas são Case Sensitive!`);
                await interaction.reply({ embeds: [successEmbed], flags: 64 });
                
                logger.log(`Canal de registro configurado: ${channel.id} no servidor ${guild.id} por ${user.tag}`, 'CONFIG');
                
            } else if (commandName === 'registered') {
                const channel = options.getChannel('canal');
                
                const botMember = guild.members.cache.get(client.user.id);
                const channelPermissions = channel.permissionsFor(botMember);
                
                if (!channelPermissions.has(PermissionsBitField.Flags.SendMessages)) {
                    const embed = createErrorEmbed('Permissão Insuficiente', `Não tenho permissão para enviar mensagens no canal ${channel.toString()}.`);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                
                if (!channelPermissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    const embed = createErrorEmbed('Permissão Insuficiente', `Não tenho permissão para ver o canal ${channel.toString()}.`);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                
                if (!channelPermissions.has(PermissionsBitField.Flags.AttachFiles)) {
                    const embed = createErrorEmbed('Permissão Insuficiente', `Não tenho permissão para anexar arquivos no canal ${channel.toString()}. Isso é necessário para enviar as imagens dos veículos.`);
                    return interaction.reply({ embeds: [embed], flags: 64 });
                }
                
                db.setVehiclesChannel(guild.id, channel.id);
                
                const successEmbed = createSuccessEmbed('Configuração Concluída', `✅ O canal para veículos registrados foi configurado como ${channel.toString()}!\n\nTodos os novos veículos registrados aparecerão neste canal.`);
                await interaction.reply({ embeds: [successEmbed], flags: 64 });
                
                logger.log(`Canal de veículos configurado: ${channel.id} no servidor ${guild.id} por ${user.tag}`, 'CONFIG');
            }
        }
        
        // Botões
        if (interaction.isButton()) {
            if (interaction.customId === 'register_vehicle') {
                const modal = new ModalBuilder()
                    .setCustomId('vehicle_modal')
                    .setTitle('🚗 Registrar Novo Veículo');
                
                const plateInput = new TextInputBuilder()
                    .setCustomId('plate')
                    .setLabel('🔢 Placa do Veículo (Case Sensitive)')
                    .setPlaceholder('Ex: ABC1234 ou xYz9E99')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(10);
                
                const modelInput = new TextInputBuilder()
                    .setCustomId('model')
                    .setLabel('🚘 Modelo do Veículo')
                    .setPlaceholder('Ex: Honda Civic 2023, Toyota Corolla')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(50);
                
                const colorInput = new TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('🎨 Cor do Veículo')
                    .setPlaceholder('Ex: Prata, Preto, Vermelho, Azul')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(30);
                
                const yearInput = new TextInputBuilder()
                    .setCustomId('year')
                    .setLabel('📅 Ano do Veículo')
                    .setPlaceholder('Ex: 2020, 2021, 2022')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(4);
                
                const priceInput = new TextInputBuilder()
                    .setCustomId('price')
                    .setLabel(`💰 Preço do Veículo (Limite ${formatPriceUSD(MAX_PRICE)} USD)`)
                    .setPlaceholder('Ex: 50000, 75,000, 130000, $130,000')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(20);
                
                const firstRow = new ActionRowBuilder().addComponents(plateInput);
                const secondRow = new ActionRowBuilder().addComponents(modelInput);
                const thirdRow = new ActionRowBuilder().addComponents(colorInput);
                const fourthRow = new ActionRowBuilder().addComponents(yearInput);
                const fifthRow = new ActionRowBuilder().addComponents(priceInput);
                
                modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
                
                await interaction.showModal(modal);
                
            } else if (interaction.customId.startsWith('list_prev_') || interaction.customId.startsWith('list_next_')) {
                const page = parseInt(interaction.customId.split('_')[2]);
                const vehicles = db.getAllVehicles(interaction.guild.id);
                await listVehiclesPaginated(interaction, vehicles, page);
                
            } else if (interaction.customId === 'list_refresh') {
                const vehicles = db.getAllVehicles(interaction.guild.id);
                await listVehiclesPaginated(interaction, vehicles, 0);
            }
        }
        
        // Modais
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'vehicle_modal') {
                await handleVehicleModal(interaction);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar interação:', error);
        const errorEmbed = createErrorEmbed('Erro no Sistema', 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.');
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ embeds: [errorEmbed], flags: 64 }).catch(() => {});
        } else {
            await interaction.followUp({ embeds: [errorEmbed], flags: 64 }).catch(() => {});
        }
    }
});

// ============================================
// MENSAGENS DE CANCELAMENTO
// ============================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    
    if (message.content.toLowerCase() === 'cancelar') {
        const embed = createInfoEmbed('Registro Cancelado', 'O processo de registro foi cancelado.\n\nPara iniciar um novo registro, clique no botão "Registrar Veículo".');
        await message.reply({ embeds: [embed] });
        return;
    }
});

// ============================================
// COMANDOS DE PREFIXO (APENAS DONO)
// ============================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!isOwner(message.author.id)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        switch (command) {
            case 'stats':
                const statsEmbed = generateStatsEmbed(message.guild);
                await message.reply({ embeds: [statsEmbed] });
                break;
                
            case 'listvehicles':
                const vehicles = db.getAllVehicles(message.guild.id);
                const itemsPerPage = 5;
                const totalPages = Math.ceil(vehicles.length / itemsPerPage);
                const start = 0;
                const end = itemsPerPage;
                const pageVehicles = vehicles.slice(start, end);
                
                const listEmbed = new EmbedBuilder()
                    .setColor(0x44AAFF)
                    .setTitle('📋 Lista de Veículos Registrados')
                    .setDescription(`Total de veículos: **${vehicles.length}**\nPágina 1 de ${totalPages || 1}`)
                    .setTimestamp();
                
                pageVehicles.forEach((vehicle, index) => {
                    listEmbed.addFields({
                        name: `${index + 1}. ${vehicle.model} (${vehicle.plate})`,
                        value: `🎨 Cor: ${vehicle.color}\n📅 Ano: ${vehicle.year}\n💰 Preço: ${formatPriceUSD(parseFloat(vehicle.price))}\n🆔 ID: \`${vehicle.id}\``,
                        inline: false
                    });
                });
                
                if (vehicles.length === 0) {
                    listEmbed.setDescription('Nenhum veículo registrado ainda.');
                }
                
                const row = new ActionRowBuilder();
                if (vehicles.length > itemsPerPage) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`list_next_1`)
                            .setLabel('Próxima ▶')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                
                const components = row.components.length > 0 ? [row] : [];
                await message.reply({ embeds: [listEmbed], components });
                break;
                
            case 'searchvehicle':
                const searchTerm = args.join(' ');
                if (!searchTerm) {
                    await message.reply('❌ Por favor, informe a placa ou ID do veículo.\nExemplo: `\'searchvehicle ABC1234`');
                    break;
                }
                
                const allVehicles = db.getAllVehicles(message.guild.id);
                const found = allVehicles.find(v => v.plate === searchTerm || v.id.toLowerCase() === searchTerm.toLowerCase() || v.id.includes(searchTerm));
                
                if (!found) {
                    await message.reply(`❌ Nenhum veículo encontrado com o termo "${searchTerm}".`);
                    break;
                }
                
                const searchEmbed = new EmbedBuilder()
                    .setColor(0x44FF44)
                    .setTitle('🔍 Veículo Encontrado')
                    .setDescription(`
**👤 Dono:** <@${found.userId}>
**🚘 Modelo:** ${found.model}
**🎨 Cor:** ${found.color}
**📅 Ano:** ${found.year}
**💰 Preço:** ${formatPriceUSD(parseFloat(found.price))}
**🔢 Placa:** ${found.plate}
**🆔 ID:** \`${found.id}\`
**📅 Registrado em:** ${new Date(found.registeredAt).toLocaleString('pt-BR')}
                    `)
                    .setImage(found.imageUrl)
                    .setTimestamp();
                
                await message.reply({ embeds: [searchEmbed] });
                break;
                
            case 'deletevehicle':
                const vehicleId = args[0];
                if (!vehicleId) {
                    await message.reply('❌ Por favor, informe o ID do veículo.\nExemplo: `\'deletevehicle VEH-1700000000000-1234`');
                    break;
                }
                
                const vehicleToDelete = db.getVehicle(vehicleId);
                if (!vehicleToDelete || vehicleToDelete.guildId !== message.guild.id) {
                    await message.reply(`❌ Nenhum veículo encontrado com o ID "${vehicleId}".`);
                    break;
                }
                
                db.vehicles.delete(vehicleId);
                db.saveData();
                
                logger.log(`Veículo removido - ID: ${vehicleId} | Placa: ${vehicleToDelete.plate} | Modelo: ${vehicleToDelete.model} por ${message.author.tag}`, 'DELETE');
                await message.reply(`✅ Veículo **${vehicleToDelete.model}** (Placa: ${vehicleToDelete.plate}) foi removido com sucesso!`);
                break;
                
            case 'exportdata':
                const exportPath = exportGuildData(message.guild.id);
                const fileName = path.basename(exportPath);
                
                await message.reply({
                    content: `✅ Dados exportados com sucesso!\n**Arquivo:** \`${fileName}\``,
                    files: [exportPath]
                });
                
                setTimeout(() => {
                    try { fs.unlinkSync(exportPath); } catch (err) {}
                }, 60000);
                break;
                
            case 'backup':
                const backupAction = args[0];
                if (backupAction === 'criar') {
                    backupSystem.createBackup();
                    await message.reply('✅ Backup criado com sucesso!');
                } else if (backupAction === 'listar') {
                    const backups = backupSystem.listBackups();
                    if (backups.length === 0) {
                        await message.reply('📁 Nenhum backup encontrado.');
                    } else {
                        const backupList = backups.map((b, i) => `${i + 1}. ${b}`).join('\n');
                        await message.reply(`📁 **Backups disponíveis:**\n${backupList}\n\nUse \`${PREFIX}restaurar <nome_do_backup>\` para restaurar.`);
                    }
                } else {
                    await message.reply('📋 Uso: `\'backup criar` ou `\'backup listar`');
                }
                break;
                
            case 'restaurar':
                const backupFile = args[0];
                if (!backupFile) {
                    await message.reply('❌ Por favor, informe o nome do arquivo de backup.\nUse `\'backup listar` para ver os backups disponíveis.');
                    break;
                }
                const success = backupSystem.restoreBackup(backupFile);
                if (success) {
                    await message.reply(`✅ Backup **${backupFile}** restaurado com sucesso!`);
                } else {
                    await message.reply(`❌ Não foi possível restaurar o backup **${backupFile}**. Verifique se o arquivo existe.`);
                }
                break;
                
            case 'blockplate':
                const blockPlate = args[0];
                const blockReason = args.slice(1).join(' ') || 'Não especificado';
                if (!blockPlate) {
                    await message.reply('❌ Use: `\'blockplate PLACA [motivo]`');
                    break;
                }
                
                if (plateModeration.isPlateBlocked(message.guild.id, blockPlate)) {
                    await message.reply(`❌ A placa **${blockPlate}** já está na lista de bloqueio.`);
                    break;
                }
                
                plateModeration.blockPlate(message.guild.id, blockPlate, blockReason, message.author.id);
                await message.reply(`✅ Placa **${blockPlate}** bloqueada com sucesso!\nMotivo: ${blockReason}`);
                break;
                
            case 'unblockplate':
                const unblockPlate = args[0];
                if (!unblockPlate) {
                    await message.reply('❌ Use: `\'unblockplate PLACA`');
                    break;
                }
                
                if (!plateModeration.isPlateBlocked(message.guild.id, unblockPlate)) {
                    await message.reply(`❌ A placa **${unblockPlate}** não está na lista de bloqueio.`);
                    break;
                }
                
                plateModeration.unblockPlate(message.guild.id, unblockPlate);
                await message.reply(`✅ Placa **${unblockPlate}** desbloqueada com sucesso!`);
                break;
                
            case 'listblocked':
                const blockedPlates = plateModeration.getBlockedPlates(message.guild.id);
                if (blockedPlates.length === 0) {
                    await message.reply('📋 Nenhuma placa bloqueada neste servidor.');
                } else {
                    await message.reply(`🚫 **Placas Bloqueadas:**\n${blockedPlates.map((p, i) => `${i + 1}. \`${p}\``).join('\n')}\n\nTotal: ${blockedPlates.length}`);
                }
                break;
                
            case 'cleanup':
                const cleanType = args[0];
                if (cleanType === 'users') {
                    await message.reply('🧹 Iniciando limpeza de usuários ausentes...');
                    const removed = await maintenanceSystem.cleanupUsers(message.guild);
                    await message.reply(`✅ Limpeza concluída! **${removed}** registros de usuários ausentes foram removidos.`);
                } else if (cleanType === 'old') {
                    await message.reply('🧹 Iniciando limpeza de registros antigos (+30 dias)...');
                    const removed = await maintenanceSystem.cleanOldRecords();
                    await message.reply(`✅ Limpeza concluída! **${removed}** registros antigos foram removidos.`);
                } else if (cleanType === 'orphan') {
                    await message.reply('🧹 Iniciando limpeza de dados órfãos...');
                    const removed = await maintenanceSystem.cleanOrphanData();
                    await message.reply(`✅ Limpeza concluída! **${removed}** registros órfãos foram removidos.`);
                } else {
                    await message.reply('📋 Uso: `\'cleanup users` | `\'cleanup old` | `\'cleanup orphan`');
                }
                break;
                
            case 'setwebhook':
                const webhookUrl = args[0];
                if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                    await message.reply('❌ URL inválida! A URL deve ser um webhook válido do Discord.\nExemplo: `\'setwebhook https://discord.com/api/webhooks/...`');
                    break;
                }
                webhookManager.saveWebhook(webhookUrl);
                await webhookManager.sendNotification('🔗 Webhook Configurado', 'O sistema de notificações foi ativado com sucesso!', 0x44FF44);
                logger.log(`Webhook configurado por ${message.author.tag}`, 'WEBHOOK');
                await message.reply('✅ Webhook configurado e testado com sucesso!');
                break;
                
            case 'broadcast':
                const broadcastMsg = args.join(' ');
                if (!broadcastMsg) {
                    await message.reply('❌ Por favor, informe a mensagem a ser enviada.\nExemplo: `\'broadcast Olá pessoal!`');
                    break;
                }
                
                await message.reply('📢 Enviando broadcast para todos os servidores...');
                
                let successCount = 0;
                let failCount = 0;
                
                for (const [guildId, guild] of client.guilds.cache) {
                    try {
                        const config = db.getGuildConfig(guildId);
                        if (config.vehiclesChannelId) {
                            const channel = guild.channels.cache.get(config.vehiclesChannelId);
                            if (channel) {
                                const broadcastEmbed = new EmbedBuilder()
                                    .setColor(0x44AAFF)
                                    .setTitle('📢 Anúncio do Sistema')
                                    .setDescription(broadcastMsg)
                                    .setTimestamp()
                                    .setFooter({ text: 'Vehix - Sistema de Notificações' });
                                await channel.send({ embeds: [broadcastEmbed] });
                                successCount++;
                            }
                        }
                    } catch (error) {
                        failCount++;
                        console.error(`Erro ao enviar broadcast para ${guildId}:`, error);
                    }
                }
                
                logger.log(`Broadcast enviado por ${message.author.tag}: ${broadcastMsg.substring(0, 100)}`, 'BROADCAST');
                await message.reply(`✅ Broadcast enviado para **${successCount}** servidores.\n❌ Falhas: **${failCount}**`);
                break;
                
            case 'help':
            case 'ajuda':
                const helpEmbed = new EmbedBuilder()
                    .setColor(0x44AAFF)
                    .setTitle('📚 Comandos do Vehix')
                    .setDescription(`
**Comandos Slash (Apenas Dono):**
\`/register #canal\` - Configura canal do botão de registro
\`/registered #canal\` - Configura canal dos veículos

**Comandos de Prefixo (Apenas Dono - ${PREFIX}):**
\`${PREFIX}stats\` - Estatísticas do servidor
\`${PREFIX}listvehicles\` - Lista todos os veículos
\`${PREFIX}searchvehicle <termo>\` - Busca veículo por placa/ID
\`${PREFIX}deletevehicle <id>\` - Remove um veículo
\`${PREFIX}exportdata\` - Exporta dados do servidor
\`${PREFIX}backup criar|listar\` - Gerenciar backups
\`${PREFIX}restaurar <arquivo>\` - Restaura um backup
\`${PREFIX}blockplate <placa> [motivo]\` - Bloqueia uma placa
\`${PREFIX}unblockplate <placa>\` - Desbloqueia uma placa
\`${PREFIX}listblocked\` - Lista placas bloqueadas
\`${PREFIX}cleanup users|old|orphan\` - Limpeza de dados
\`${PREFIX}setwebhook <url>\` - Configura webhook
\`${PREFIX}broadcast <msg>\` - Envia mensagem para todos servidores

**Informações:**
💰 **Preço máximo:** ${formatPriceUSD(MAX_PRICE)} USD
🔠 **Placas:** Case Sensitive (ABC1234 ≠ abc1234)
📸 **Imagem:** Enviada separadamente com flags 64
                    `)
                    .setTimestamp();
                await message.reply({ embeds: [helpEmbed] });
                break;
                
            default:
                if (command) {
                    await message.reply(`❌ Comando desconhecido: \`${PREFIX}${command}\`\nDigite \`${PREFIX}ajuda\` para ver todos os comandos disponíveis.`);
                }
                break;
        }
    } catch (error) {
        console.error('❌ Erro no comando:', error);
        await message.reply('❌ Ocorreu um erro ao executar este comando.');
    }
});
// ============================================
// PARTE 4/4 - EVENTOS DE SERVIDOR E FINALIZAÇÃO
// ============================================

client.on('guildCreate', async (guild) => {
    console.log(`✅ Bot adicionado ao servidor: ${guild.name} (${guild.id})`);
    
    const embed = new EmbedBuilder()
        .setColor(0x44FF44)
        .setTitle('🚗 Vehix está online!')
        .setDescription(`
Obrigado por adicionar o **Vehix** ao seu servidor!

**Para começar a usar o sistema:**

1️⃣ Use o comando \`/register\` para configurar o canal de registro
2️⃣ Use o comando \`/registered\` para configurar o canal de veículos
3️⃣ O botão "Registrar Veículo" aparecerá no canal configurado

**Informações importantes:**
💰 Limite máximo de preço: **${formatPriceUSD(MAX_PRICE)} USD**
🔠 Placas são **Case Sensitive** (respeitam maiúsculas/minúsculas)
📸 Imagens são enviadas com flags 64

**Comandos do dono:**
\`${PREFIX}ajuda\` - Mostra todos os comandos disponíveis

**Precisa de ajuda?**
Apenas o <@${OWNER_ID}> pode configurar o sistema.

Obrigado por escolher o Vehix! 🚀
        `)
        .setTimestamp()
        .setFooter({ text: 'Vehix - Sistema Profissional de Registro de Veículos' });
    
    const systemChannel = guild.systemChannel || guild.channels.cache.find(ch => ch.name === 'geral' || ch.name === 'general');
    if (systemChannel && systemChannel.permissionsFor(guild.members.cache.get(client.user.id)).has('SendMessages')) {
        await systemChannel.send({ embeds: [embed] });
    }
    
    await webhookManager.notifyGuildJoin(guild);
    logger.log(`Bot adicionado ao servidor: ${guild.name} (${guild.id}) - Membros: ${guild.memberCount}`, 'GUILD');
});

client.on('guildDelete', async (guild) => {
    console.log(`❌ Bot removido do servidor: ${guild.name} (${guild.id})`);
    
    await webhookManager.notifyGuildLeave(guild);
    logger.log(`Bot removido do servidor: ${guild.name} (${guild.id})`, 'GUILD');
});

client.on('error', (error) => {
    console.error('❌ Erro no cliente Discord:', error);
    logger.error(`Erro no cliente Discord: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada não tratada:', error);
    logger.error(`Promise rejeitada: ${error.message}`);
});

process.on('SIGINT', () => {
    console.log('🛑 Bot sendo desligado...');
    logger.log('Bot desligado via SIGINT', 'SHUTDOWN');
    process.exit(0);
});

// ============================================
// INICIALIZAÇÃO FINAL
// ============================================

console.log('='.repeat(50));
console.log('🚗 VEHIX - SISTEMA DE REGISTRO DE VEÍCULOS');
console.log('='.repeat(50));
console.log('✅ Sistema iniciado com sucesso!');
console.log(`📁 Diretório de dados: ${DATA_DIR}`);
console.log(`💾 Diretório de backups: ${BACKUP_DIR}`);
console.log(`📝 Diretório de logs: ${LOGS_DIR}`);
console.log(`💰 Limite máximo de preço: ${formatPriceUSD(MAX_PRICE)} USD`);
console.log(`🔠 Placas: Case Sensitive`);
console.log(`🔧 Prefixo de admin: ${PREFIX}`);
console.log('='.repeat(50));

module.exports = { client, db, logger, backupSystem, webhookManager, maintenanceSystem, plateModeration };

client.login(process.env.TOKEN);