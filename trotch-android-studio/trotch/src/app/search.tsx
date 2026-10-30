import { router, useLocalSearchParams } from 'expo-router';
import { PlaceSearch } from '@/components/PlaceSearch';
import { Screen } from '@/components/Screen';
import { usePlanner } from '@/features/planner/PlannerProvider';

export default function SearchScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const target = field === 'origin' ? 'origin' : 'destination';
  const { setPlace } = usePlanner();

  return (
    <Screen edges={['bottom']}>
      <PlaceSearch
        placeholder={target === 'origin' ? 'Where are you starting from?' : 'Where are you going?'}
        onPick={(p) => {
          setPlace(target, p);
          router.back();
        }}
      />
    </Screen>
  );
}
