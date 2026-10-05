import { useCallback, useId, type MutableRefObject } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  joinGameSchema,
  onlyDigits,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  type JoinGameValues,
} from '@/lib/validators';

export interface JoinGameFormProps {
  /** Lets the hero "Jogar agora" CTA move focus into the PIN field. */
  pinInputRef?: MutableRefObject<HTMLInputElement | null>;
  title?: string;
  className?: string;
}

/** PIN entry form for players joining an existing room. */
export function JoinGameForm({
  pinInputRef,
  title = 'Entrar em uma sala',
  className,
}: JoinGameFormProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JoinGameValues>({
    resolver: zodResolver(joinGameSchema),
    mode: 'onTouched',
    defaultValues: { pin: '' },
  });

  const pin = watch('pin') ?? '';
  const { ref: fieldRef, ...pinField } = register('pin');

  const handlePinRef = useCallback(
    (node: HTMLInputElement | null) => {
      fieldRef(node);
      if (pinInputRef) pinInputRef.current = node;
    },
    [fieldRef, pinInputRef],
  );

  const onValidSubmit = (values: JoinGameValues) => {
    const cleanPin = onlyDigits(values.pin);
    navigate(`/jogar/${cleanPin}`);
  };

  const form = (
    <form
      className="flex flex-col gap-4"
      aria-labelledby={titleId}
      noValidate
      onSubmit={handleSubmit(onValidSubmit)}
    >
      <Input
        {...pinField}
        ref={handlePinRef}
        size="lg"
        label="Digite o PIN da partida"
        placeholder="000000"
        value={pin}
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_MAX_LENGTH}
        helperText={`Somente números, entre ${PIN_MIN_LENGTH} e ${PIN_MAX_LENGTH} dígitos.`}
        error={errors.pin?.message}
        inputClassName="text-center font-mono tracking-[0.35em] placeholder:font-sans placeholder:tracking-normal"
        onChange={(event) =>
          setValue('pin', onlyDigits(event.target.value), {
            shouldValidate: Boolean(errors.pin),
            shouldDirty: true,
          })
        }
      />
      <Button type="submit" size="lg" className="w-full">
        Entrar na partida
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );

  return (
    <Card variant="elevated" className={cn('w-full', className)}>
      <CardHeader>
        <h2 id={titleId} className="type-h4 text-neutral-900">
          {title}
        </h2>
        <CardDescription>O PIN aparece na tela de quem criou a partida.</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
