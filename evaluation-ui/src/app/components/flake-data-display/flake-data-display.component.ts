import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlakeData } from '../../services/data.service';
import { memoize } from 'lodash-es';

@Component({
  selector: 'app-flake-data-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flake-data-display.component.html',
  styleUrls: ['./flake-data-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlakeDataDisplayComponent {
  @Input() flakeData?: FlakeData;
  public groupLines = memoize((numbers: number[]) => {
    const groups = [];
    let start = numbers[0];
    let end = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === end + 1) {
        end = numbers[i];
      } else {
        groups.push({ start, end });
        start = numbers[i];
        end = numbers[i];
      }
    }
    groups.push({ start, end });
    return groups;
  });
}
