(function (global) {
    const cacheKey = 'umami-share-cache';
    const cacheTTL = 3600_000; // 1h

    /**
     * 获取网站统计数据
     * @param {string} baseUrl - Umami Cloud API基础URL
     * @param {string} apiKey - API密钥
     * @param {string} websiteId - 网站ID
     * @returns {Promise<object>} 网站统计数据
     */
    async function fetchWebsiteStats(baseUrl, apiKey, websiteId) {
        // 检查缓存
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < cacheTTL) {
                    return parsed.value;
                }
            } catch {
                localStorage.removeItem(cacheKey);
            }
        }

        const currentTimestamp = Date.now();
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const statsUrl = `${cleanBaseUrl}/v1/websites/${websiteId}/stats?startAt=0&endAt=${currentTimestamp}`;

        const res = await fetch(statsUrl, {
            headers: {
                'x-umami-api-key': apiKey
            }
        });

        if (!res.ok) {
            throw new Error('获取网站统计数据失败');
        }

        const stats = await res.json();

        // 处理 V3 响应格式
        const normalizedStats = {
            pageviews: typeof stats.pageviews === 'object' ? stats.pageviews.value : (stats.pageviews || 0),
            visitors: typeof stats.visitors === 'object' ? stats.visitors.value : (stats.visitors || 0),
            visits: typeof stats.visits === 'object' ? stats.visits.value : (stats.visits || 0),
            bounces: typeof stats.bounces === 'object' ? stats.bounces.value : (stats.bounces || 0),
            totaltime: typeof stats.totaltime === 'object' ? stats.totaltime.value : (stats.totaltime || 0)
        };

        // 缓存结果
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), value: normalizedStats }));

        return normalizedStats;
    }

    /**
     * 获取特定页面的统计数据
     * @param {string} baseUrl - Umami Cloud API基础URL
     * @param {string} apiKey - API密钥
     * @param {string} websiteId - 网站ID
     * @param {string} urlPath - 页面路径
     * @param {number} startAt - 开始时间戳
     * @param {number} endAt - 结束时间戳
     * @returns {Promise<object>} 页面统计数据
     */
    async function fetchPageStats(baseUrl, apiKey, websiteId, urlPath, startAt = 0, endAt = Date.now()) {
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const statsUrl = `${cleanBaseUrl}/v1/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}&path=${encodeURIComponent(urlPath)}`;

        const res = await fetch(statsUrl, {
            headers: {
                'x-umami-api-key': apiKey
            }
        });

        if (!res.ok) {
            throw new Error('获取页面统计数据失败');
        }

        const stats = await res.json();
        
        // 处理 V3 响应格式，可能是 { pageviews: { value: 123 }, visitors: { value: 45 } } 或者是 { pageviews: 123, visitors: 45 }
        return {
            pageviews: typeof stats.pageviews === 'object' ? stats.pageviews.value : (stats.pageviews || 0),
            visitors: typeof stats.visitors === 'object' ? stats.visitors.value : (stats.visitors || 0),
            visits: typeof stats.visits === 'object' ? stats.visits.value : (stats.visits || 0),
            bounces: typeof stats.bounces === 'object' ? stats.bounces.value : (stats.bounces || 0),
            totaltime: typeof stats.totaltime === 'object' ? stats.totaltime.value : (stats.totaltime || 0)
        };
    }

    /**
     * 获取 Umami 网站统计数据
     * @param {string} baseUrl - Umami Cloud API基础URL
     * @param {string} apiKey - API密钥
     * @param {string} websiteId - 网站ID
     * @returns {Promise<object>} 网站统计数据
     */
    global.getUmamiWebsiteStats = async function (baseUrl, apiKey, websiteId) {
        try {
            return await fetchWebsiteStats(baseUrl, apiKey, websiteId);
        } catch (err) {
            throw new Error(`获取Umami统计数据失败: ${err.message}`);
        }
    };

    /**
     * 获取特定页面的 Umami 统计数据
     * @param {string} baseUrl - Umami Cloud API基础URL
     * @param {string} apiKey - API密钥
     * @param {string} websiteId - 网站ID
     * @param {string} urlPath - 页面路径
     * @param {number} startAt - 开始时间戳（可选）
     * @param {number} endAt - 结束时间戳（可选）
     * @returns {Promise<object>} 页面统计数据
     */
    global.getUmamiPageStats = async function (baseUrl, apiKey, websiteId, urlPath, startAt, endAt) {
        try {
            return await fetchPageStats(baseUrl, apiKey, websiteId, urlPath, startAt, endAt);
        } catch (err) {
            throw new Error(`获取Umami页面统计数据失败: ${err.message}`);
        }
    };

    global.clearUmamiShareCache = function () {
        localStorage.removeItem(cacheKey);
    };
})(window);