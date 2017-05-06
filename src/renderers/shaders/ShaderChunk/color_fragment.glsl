#if defined(USE_COLOR)

	diffuseColor.rgb *= vColor;

#endif

#if defined(INSTANCE_COLOR)

	diffuseColor.rgb *= vInstanceColor;

#endif