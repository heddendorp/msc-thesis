import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlakeData } from '../../services/data.service';

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
}
