// Critical file that requires manual conflict resolution
export class CriticalService {
  private apiKey: string
  private endpoint: string

  constructor() {
    this.apiKey = 'base-key'
    this.endpoint = 'https://api.base.com'
  }

  async performCriticalOperation(): Promise<void> {
    // Base implementation
    console.log('Performing critical operation')
  }
}
