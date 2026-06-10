import { TestBed } from '@angular/core/testing';
import { StatusChipComponent } from './status-chip.component';

describe('StatusChipComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StatusChipComponent] });
  });

  it('renders a humanized label and maps the value to a CSS variable', () => {
    const fixture = TestBed.createComponent(StatusChipComponent);
    fixture.componentRef.setInput('value', 'IN_PROGRESS');
    fixture.componentRef.setInput('kind', 'status');
    fixture.detectChanges();

    const chip: HTMLElement = fixture.nativeElement.querySelector('.chip');
    expect(chip.textContent?.trim()).toContain('In progress');
    expect(chip.style.getPropertyValue('--chip-color')).toBe(
      'var(--status-in_progress)',
    );
  });

  it('uses the priority palette when kind is priority', () => {
    const fixture = TestBed.createComponent(StatusChipComponent);
    fixture.componentRef.setInput('value', 'URGENT');
    fixture.componentRef.setInput('kind', 'priority');
    fixture.detectChanges();

    const chip: HTMLElement = fixture.nativeElement.querySelector('.chip');
    expect(chip.style.getPropertyValue('--chip-color')).toBe(
      'var(--priority-urgent)',
    );
  });
});
