export function baseFunction(): string {
  console.log('Base version');
  return 'base';
}

export class BaseClass {
  private value: string;

  constructor() {
    this.value = 'base';
  }

  getValue(): string {
    return this.value;
  }
}