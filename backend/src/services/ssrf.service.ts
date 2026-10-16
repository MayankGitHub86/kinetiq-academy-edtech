import dns from 'dns';
import { promisify } from 'util';
import ipaddr from 'net';

const dnsLookup = promisify(dns.lookup);

export class SSRFProtection {
  private static isPrivateIp(ip: string): boolean {
    // Check IPv4 private and reserved ranges
    if (ip.startsWith('127.') || ip === '0.0.0.0' || ip === 'localhost') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true; // AWS metadata & link-local
    
    // 172.16.0.0 - 172.31.255.255
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    // Check IPv6 loopback / unique local / link-local
    if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return true;
    }

    return false;
  }

  public static async validateUrl(urlString: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http: and https: are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block obvious loopback names
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '0.0.0.0') {
      throw new Error('SSRF Protection: Access to localhost/internal addresses is forbidden.');
    }

    // If hostname is directly an IP
    if (ipaddr.isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new Error(`SSRF Protection: Access to private IP ${hostname} is forbidden.`);
      }
    } else {
      // Resolve DNS to verify resolved IP is public
      try {
        const lookup = await dnsLookup(hostname);
        if (this.isPrivateIp(lookup.address)) {
          throw new Error(`SSRF Protection: Domain ${hostname} resolves to private IP ${lookup.address}. Access forbidden.`);
        }
      } catch (err: any) {
        if (err.message && err.message.includes('SSRF Protection')) throw err;
        throw new Error(`Could not resolve hostname ${hostname}: ${err.message}`);
      }
    }

    return parsed;
  }
}
